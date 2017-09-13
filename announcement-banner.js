// if copy pasting to announcement banner, uncomment next line
// <script>

AJS.$.getScript('https://cdn.rawgit.com/chadn/custom-jira-javascript/master/custom-jira.js', function() {
    console.log("Loaded custom-jira.js, jquery ver=" + AJS.$.fn.jquery);
    try {
        window.cj = AJS.CustomJira({
            debug:true,
            enableEpicTimeTracking: true,
            enableEpicTableChanges: true,
            jqlOrderByObject: {
                '*' : 'ORDER BY status ASC, priority DESC, resolution DESC, updatedDate ASC, project ASC'
            }
        });
        console.log("Instantiated AJS.CustomJira as window.cj", window.cj);
    } catch (e) {
        console.warn("Skipping CustomJira in announcement banner, error: ", e);
    }
});

// Hide banner, since we are only using it for javascript
AJS.$('#announcement-banner').css('display','none');


// Google Analyitcs - using gtag.js beta, instead of analytics.js
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments)};
gtag('js', new Date());
gtag('config', 'UA-xxxxxxx');
gtag('set', {'user_id': getCurrentUser() }); // Set the user ID using signed-in user_id.

function getCurrentUser() {
    var userId = 'unknown';
    if (AJS.$('#user-options .login-link').length) {
        userId = 'anonymous';
    }
    if (AJS.$('#header-details-user-fullname').length) {
        userId = AJS.$('#header-details-user-fullname').data('username');
    }
    return userId.hashcode();
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// if copy pasting to announcement banner, uncomment next 2 lines
//</script>
//<script async src="https://www.googletagmanager.com/gtag/js?id=UA-xxxxxxx"></script>


