// https://github.com/chadn/custom-jira-javascript
(function(){

var CustomJira = AJS.CustomJira = makeClass();

/**
 * Initialize
 *
 * @param {Object} [opts] - an optional set of configuration options, details in comments. 
 */
CustomJira.prototype.init = function(opts) {
    var me = this;

    // All of the optsDefaults can be modified by passing them as options. If the opts object
    // contains a key that is not part of optsDefault, it will be ignored. 
    me.optsDefaults =  {

        // enableEpicTimeTracking - if exists and true, will add 'Time Tracking' summary on epic issues
        enableEpicTimeTracking: true,

        // enableEpicTableChanges - if exists and true, will add sort 'Issues in epic' table, and
        // add "xx of yy Resolved" link at top right of table.
        enableEpicTableChanges: true,

        // If enableEpicTableChanges, jqlOrderByObject will determine the order of 'Issues in epic' table.
        // It is object where key is jira userid and val is personalized JQL 'ORDER BY ...'
        // if key is '*', then val will be default for all
        'jqlOrderByObject': {
            // Regarding status sort - Jira Admins can customize status sort order in /secure/admin/ViewStatuses.jspa
            '*'    : 'ORDER BY status ASC, priority DESC, resolution DESC, updatedDate ASC, project ASC'
        },

        enableScriptRunnerJQL: false,  // set to true if you the ScriptRunner add-on
        // waiting for parentEpic() https://jira.atlassian.com/browse/JRASERVER-59181

        // if debug==true, then extra console.log msgs will be written
        debug: false
    };

    me.optsValid = me.extendKeys( opts,  me.optsDefaults);
    me = me.extendKeys( me.optsDefaults, me.optsDefaults, me);
    me = me.extendKeys( me.optsValid,    me.optsDefaults, me);

    me.debug && console.log('CustomJira init valid opts:', me.optsValid);

    me.userId = me.getCurrentUser();
    me.jqlOrderBy = me.jqlOrderByObject[me.userId] || me.jqlOrderByObject['*'];

    me.runit();

    // Also run on refresh, like when going from JQL results to clicking on individual epic
    JIRA.bind(JIRA.Events.ISSUE_REFRESHED, me.runit.bind(me) );

    return me;
};


/**
 * Runs what is enabled, on page load or when when page is refreshed.
 */
CustomJira.prototype.runit = function() {
    var me = this;
    me.debug && console.log("CustomJira.prototype.runit", me);

    // Wait until page is loaded
    AJS.toInit(function() {

        me.updateEpicIssue();
    });
};


/**
 * Parses the "Issues in Epic" table.
 *
 * @returns {Object} table row data, where each object key is the issue key, object value is html
 */
CustomJira.prototype.getEpicTableRows = function() {
    if (!AJS.$('#ghx-issues-in-epic-table tbody').html()) return {};
    var found;
    var trObj = {};
    var trArr = AJS.$('#ghx-issues-in-epic-table tbody').html().split('</tr>');
    for (var ii=0; ii<trArr.length; ii++) {
        found = trArr[ii].match(/data-issuekey="([-\w]+)"/);
        if (found && found[1]) {
            trObj[found[1]] = trArr[ii] + '</tr>';
            //trObj[found[1]] = trArr[ii].replace(/\s+$/,'').replace(/^\s+/,'') + '</tr>';
        }
    }
    return trObj;
};


/**
 * Modifies "Issues in Epic" table, adding priority icon, and reordering rows.
 *
 * @param {Object} tr - table row data, from getEpicTableRows
 */
CustomJira.prototype.updateEpicTable = function(tr) {
    var me = this;
    var issuesObj = {};
    var html = '';

    // reorder table
    AJS.$.each(me.epicApiData.issues, function(indx,issue){
        if (!tr[issue.key]) {
            console.log('Error, data.issues changed, aborting. ', issue);
            return;
        }
        issuesObj[issue.key] = issue;
        html += tr[issue.key];
    });
    AJS.$('#ghx-issues-in-epic-table tbody').html(html);
    me.debug && console.log('reordered issues in epic table', me.epicApiData.issues);

    // add new priority column
    me.debug && AJS.$('#ghx-issues-in-epic-table td.priority').remove();  // delete existing 
    if (AJS.$('#ghx-issues-in-epic-table td.priority').html()) {
        me.debug && console.log('already added priority column, skipping');
        return;
    }

    AJS.$('#ghx-issues-in-epic-table tr').each(function(){
        var row = this;
        var issueKey = AJS.$(this).attr("data-issuekey");
        var hoverText = issuesObj[issueKey].fields.priority.name + ' Priority. ' +
            " Estimated: " + me.uiFriendlyTime(issuesObj[issueKey].fields.aggregatetimeoriginalestimate) +
            ", Remaining: " + me.uiFriendlyTime(issuesObj[issueKey].fields.aggregatetimeestimate) +
            ", Logged: " + me.uiFriendlyTime(issuesObj[issueKey].fields.aggregatetimespent);
        var value = '<img src="' + issuesObj[issueKey].fields.priority.iconUrl + '" title="' + hoverText +
            '" alt="' + issuesObj[issueKey].fields.priority.name + '" width="16px">';
        //console.log('Value - ' + value);
        var actions = AJS.$(row).find('td.issuetype');

        AJS.$(actions).before('<td class="nav priority">' + value + '</td>');
        me.debug && console.log('added priority column for issue key '  + issueKey);
    });
};

/**
 * Uses Jira API to get more data on all the issues in the epic, then calls other
 * functions to update the document.
 */
CustomJira.prototype.updateEpicIssue = function() {
    var me = this;

    // return if features not enabled
    if (!(me.enableEpicTimeTracking || me.enableEpicTableChanges)) return;

    // return if not on Epic Issue page
    var tr = me.getEpicTableRows();
    if (!(typeof tr == 'object' && Object.keys(tr).length)) return;


    me.epicKey = AJS.$('#key-val').text();

    me.apiSearch({
        maxResults: 999,
        fields: 'aggregatetimeestimate,aggregatetimeoriginalestimate,aggregatetimespent' +
            ',priority,resolutiondate,status,duedate', 
        jql: '"Epic Link" = '+ me.epicKey +' '+ me.jqlOrderBy
    }, function(data){
        me.epicApiData = data;
        me.enableEpicTableChanges && me.updateEpicTable(tr);
        me.enableEpicTableChanges && me.addJqlLink();
        me.enableEpicTimeTracking && me.updateTotalTime();
    });

};

/**
 * Adds the "xx of yy Resolved" link to top right of "Issues in Epic" table.
 */
CustomJira.prototype.addJqlLink = function() {
    var me = this;
    var resolvedCount = 0;
    var html;
    
    AJS.$.each(me.epicApiData.issues, function(indx,issue){
        if (issue.fields.status.name == 'Closed' || issue.fields.status.name == 'Resolved') {
            resolvedCount += 1;
        }
        me.debug && console.log('addJqlLink: '+ indx +') '+ issue.key +' '+ (issue.fields.resolutiondate ? 1 : 0));
    });

    html = '<li class="jql">&nbsp;<a target="_blank" title="View \'Issues in Epic\' in Issue Navigator (JQL)"';
    html += 'href="/issues/?jql='+ encodeURIComponent('"Epic Link"='+ me.epicKey +' '+ me.jqlOrderBy) +'">';
    html += resolvedCount + ' of ' + me.epicApiData.total +' Resolved</a>&nbsp;</li>';
    AJS.$('#greenhopper-epics-issue-web-panel_heading .jql').remove();
    AJS.$('#greenhopper-epics-issue-web-panel_heading ul').prepend(html);
};

/*
 * @returns {string} url used to summarize time tracking info in JQL similar to what is
 * done in updateTotalTime
 */
CustomJira.prototype.buildUrlEpicTasksSubtasks = function() {
    var me = this;

    var jql = '"Epic Link"=' + me.epicKey;

    // enableScriptRunnerJQL must be true to use issueFunction, aggregateExpression
    if (me.enableScriptRunnerJQL) {
        // note that encodeURIComponent() will not encode ' but we encode it manually using replace() below.
        jql = '(' + jql + ' OR issueFunction in subtasksOf(\''+ jql + '\'))';
        jql += ' AND issueFunction in aggregateExpression("Epic Estimated","originalestimate.sum()",';
        jql += '"Epic Remaining", "remainingEstimate.sum()", "Epic Logged", "timespent.sum()")';
    } else {
        // ?
    }
    jql += ' ' + me.jqlOrderBy;

    return "/issues/?jql="+ encodeURIComponent(jql).replace(/'/g,"%27");
};

/**
 * Adds or replaces #timetrackingmodule html after aggregating time stats
 */
CustomJira.prototype.updateTotalTime = function() {
    var me = this;
    var html = me.timeTrackingHtml();
    var maxTime;
    var alltix = {
        estimated: 0,
        remaining: 0,
        loggedResolvedOnly: 0,
        logged: 0
    };
    AJS.$.each(me.epicApiData.issues, function(indx,issue){
        alltix.estimated += issue.fields.aggregatetimeoriginalestimate || 0;
        alltix.remaining += issue.fields.aggregatetimeestimate || 0;
        alltix.logged    += issue.fields.aggregatetimespent || 0;
        if (issue.fields.status.name == 'Resolved' || issue.fields.status.name == 'Closed') {
            alltix.loggedResolvedOnly += issue.fields.aggregatetimespent || 0;
        }
    });
    maxTime = Math.max(alltix.estimated, alltix.remaining, alltix.logged, 1);

    me.debug && console.log(
        " Estimated: " + me.uiFriendlyTime(alltix.estimated) +
        ", Remaining: " + me.uiFriendlyTime(alltix.remaining) +
        ", Logged: " + me.uiFriendlyTime(alltix.logged)
    );
    html = html.replace(/urlEpicTasksAndSubtasks/g, me.buildUrlEpicTasksSubtasks() );
    html = html.replace(/tEstTime/g, me.uiFriendlyTime(alltix.estimated));
    html = html.replace(/tRemTime/g, me.uiFriendlyTime(alltix.remaining));
    html = html.replace(/tLogTime/g, me.uiFriendlyTime(alltix.logged));
    html = html.replace(/tReslvTime/g, me.uiFriendlyTime(alltix.loggedResolvedOnly));
    html = html.replace(/tEstPctDone/g,     Math.floor(100*alltix.estimated/maxTime));
    html = html.replace(/tEstPctLeft/g, 100-Math.floor(100*alltix.estimated/maxTime));
    html = html.replace(/tEstRemDone/g,     Math.floor(100*alltix.remaining/maxTime));
    html = html.replace(/tEstRemLeft/g, 100-Math.floor(100*alltix.remaining/maxTime));
    html = html.replace(/tEstLogDone/g,     Math.floor(100*alltix.logged/maxTime));
    html = html.replace(/tEstLogLeft/g, 100-Math.floor(100*alltix.logged/maxTime));

    AJS.$('#timetrackingmodule').remove();
    AJS.$('#datesmodule').after(html);
};


/**
 * This function is basically a wrapper around a javascript comment that contains HTML.
 *
 * @returns {string} html needed for Time Tracking
 */
CustomJira.prototype.timeTrackingHtml = function() {
    function heredoc (f) {
        return f.toString().match(/\/\*\s*([\s\S]*?)\s*\*\//m)[1];
    }
    // If you need to update the following html, copy and paste from jira, format http://www.cleancss.com/html-beautify/,
    // then find actual times and percents and replace with variable names defined in updateTotalTime, 
    // such as tEstTime, tEstPctDone, etc
    var html = heredoc(function(){/*
<div id="timetrackingmodule" class="module toggle-wrap">

  <div id="timetrackingmodule_heading" class="mod-header">
    <ul class="ops">
        <li>
            <a href="urlEpicTasksAndSubtasks" target="_blank" title="View Time including subtasks in Jira">
                <span class="icon icon-share icon-viewissue-share"></span>
            </a>
        </li>
    </ul>
    <h2 class="toggle-title">Time Tracking</h2>
  </div>
  <div class="mod-content">

    <div id="tt_info_aggregate" style="display: block;">
      <div id="tt_aggregate_table_info" class="tt_inner">
        <dl>
          <dt id="tt_aggregate_text_orig" class="tt_text" title="Original Estimate - tEstTime">
            Estimated:
          </dt>
          <dd class="tt_graph">
            <table id="tt_aggregate_graph_orig" cellspacing="0" cellpadding="0" class="tt_graph">
              <tbody>
                <tr class="tt_graph">
                  <td style="width:tEstPctDone%; background-color:#89afd7">
                    <img src="/images/border/spacer.gif" style="height:10px; width:100%; border-width:0" class="hideOnPrint" title="Original Estimate - tEstTime" alt="Original Estimate - tEstTime">
                  </td>
                  <td style="width:tEstPctLeft%; background-color:#cccccc">
                    <img src="/images/border/spacer.gif" style="height:10px; width:100%; border-width:0" class="hideOnPrint" title="Original Estimate - tEstTime" alt="Original Estimate - tEstTime">
                  </td>
                </tr>
              </tbody>
            </table>
          </dd>
          <dd id="tt_aggregate_values_orig" class="tt_values" title="Original Estimate - tEstTime">
            <a href="urlEpicTasksAndSubtasks" class="tt_values" title="View Time including subtasks in Jira">
              tEstTime
            </a>
          </dd>
        </dl>
        <dl>
          <dt id="tt_aggregate_text_remain" class="tt_text" title="Remaining Estimate - tRemTime">
            Remaining:
          </dt>
          <dd class="tt_graph">
            <table id="tt_aggregate_graph_remain" cellspacing="0" cellpadding="0" class="tt_graph">
              <tbody>
                <tr class="tt_graph">
                  <td style="width:100%; background-color:#cccccc">
                    <img src="/images/border/spacer.gif" style="height:10px; width:100%; border-width:0" class="hideOnPrint" title="Remaining Estimate - tRemTime" alt="Remaining Estimate - tRemTime">
                  </td>
                </tr>
              </tbody>
            </table>
          </dd>
          <dd id="tt_aggregate_values_remain" class="tt_values" title="Remaining Estimate - tRemTime">
            tRemTime
          </dd>
        </dl>
        <dl>
          <dt id="tt_aggregate_text_spent" class="tt_text" title="Time Spent - tLogTime">
            Logged:
          </dt>
          <dd class="tt_graph">
            <table id="tt_aggregate_graph_spent" cellspacing="0" cellpadding="0" class="tt_graph">
              <tbody>
                <tr class="tt_graph">
                  <td style="width:tEstLogDone%; background-color:#51a825">
                    <img src="/images/border/spacer.gif" style="height:10px; width:100%; border-width:0" class="hideOnPrint" title="Time Spent - tLogTime" alt="Time Spent - tLogTime">
                  </td>
                  <td style="width:tEstLogLeft%; background-color:#cccccc">
                    <img src="/images/border/spacer.gif" style="height:10px; width:100%; border-width:0" class="hideOnPrint" title="Time Spent - tLogTime" alt="Time Spent - tLogTime">
                  </td>
                </tr>
              </tbody>
            </table>
          </dd>
          <dd id="tt_aggregate_values_spent" class="tt_values" title="Time Spent - tLogTime, Resolved only - tReslvTime">
            tLogTime
          </dd>
        </dl>
      </div>
    </div>
  </div>
</div>

    */});
    return html;
}; // timeTrackingHtml


// 
// Utility functions below
// 


/**
 * Performs search on Jira's own REST API
 *
 * @param {Object} searchParams - rest api search parameters
 * @param {CustomJira~apiSearchCallback} cb - The callback that handles the response.
 */
CustomJira.prototype.apiSearch = function(searchParams, cb) {
    var me = this || {};
    if (!(searchParams && searchParams.jql)) {
        return 'first argument must be an object with jql';
    }
    AJS.$.getJSON(AJS.contextPath() + '/rest/api/latest/search', searchParams, function(data){
        me.lastApi = {
            searchParams: searchParams,
            data: data
        };
        me.debug && console.log('Response from /rest/api/latest/search ', me.lastApi);
        if (typeof cb == 'function') cb(data);
    });
};
/**
 * This callback is displayed as part of the CustomJira class.
 * @callback CustomJira~apiSearchCallback
 * @param {data} data passed from jQuery's getJSON() callback
 */




/**
 * Converts seconds to string, like 310 to 5m10s
 *
 * @param {number} seconds 
 * @returns {string} human readble time
 */
CustomJira.prototype.uiFriendlyTime = function(seconds) {
    if (!seconds) return 0;
    var hrs = Math.floor(seconds/3600);
    var mins = Math.floor( (seconds%3600)/60 );
    //var secs = seconds % 60;
    hrs = hrs ? hrs + 'h ' : '';
    if (hrs.length > 5) {
        hrs = hrs.slice(0, -5) + ',' + hrs.substr(-5);
    }
    return hrs + (mins ? mins+'m' : '');
};


/**
 * Copies from src to obj, skipping anything that does not have a corresponding valid key
 *
 * @param {Object} src 
 * @param {Object} valid 
 * @param {Object} [obj] - created if not specified
 * @returns {Object} modified version of obj
 */
CustomJira.prototype.extendKeys = function(src, valid, obj) {
    obj || (obj = {});
    for (var key in src) {
        if (!src.hasOwnProperty(key)) continue;
        if (key in valid) {
            obj[key] = src[key];
        }
    }
    return obj;
};

/**
 * @returns {string} username used in Jira, 'anonymous' if not logged in, 'unknown' if html changed.
 */
CustomJira.prototype.getCurrentUser = function () {
    var userId = 'unknown';
    if (AJS.$('#user-options .login-link').length) {
        userId = 'anonymous';
    }
    if (AJS.$('#header-details-user-fullname').length) {
        userId = AJS.$('#header-details-user-fullname').data('username');
    }
    return userId;
};

// @returns {(number|Array)} 


/**
 * @param {Object} rapidViewNums - array of strings, each is rapidview number for a kanban board to check
 * @returns {boolean} true if current page matches the rapidViewNums 
 */
CustomJira.prototype.isKanbanBoard = function(rapidViewNums) {
    if (window.location.pathname != '/secure/RapidBoard.jspa') return false;

    var matches = window.location.search.match(/\brapidView=(\d+)\b/);
    //console.log("isKanbanBoard", rapidViewNums.indexOf(matches[1]), matches );
    
    if (-1 != rapidViewNums.indexOf(matches[1])) {
        // current window's rapidView number is in rapidViewNums
        return true;
    }
    return false;
};

/**
 * Returns true if 'component' exists on issue, false otherwise.
 *
 * @param {String} component - jira system defined component
 */
CustomJira.prototype.hasComponent = function(component) {
    var me = this;
    var found = false;

    AJS.$('#components-field a').each(function(){
        if (component == AJS.$(this).text()) found = true;
    });
    me.debug && console.log('hasComponent('+ component +') found='+ found);
    return found;
};


/**
 * makeClass - By John Resig (MIT Licensed).
 * https://johnresig.com/blog/simple-class-instantiation/
 */
function makeClass(){
  return function(args){
    if ( this instanceof arguments.callee ) {
      if ( typeof this.init == "function" )
        this.init.apply( this, args.callee ? args : arguments );
    } else
      return new arguments.callee( arguments );
  };
}

})();

