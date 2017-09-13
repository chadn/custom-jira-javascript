# Custom Jira Announcement Banner

## Summary

The announcement banner in Jira was designed as a place where announcements can be made to all JIRA users.  Basically it is a piece of HTML that is customizable and displayed on every JIRA page.  

Here we use it to customize jira using javascript for two reasons - to add features and to show how easy it is to further customize Jira.

## Setup

Must be Jira Admin to [edit the Announcement banner](https://confluence.atlassian.com/adminjiraserver074/configuring-an-announcement-banner-881683304.html). It is simple as something like this:

```
<script>
AJS.$.getScript('https://cdn.rawgit.com/chadn/custom-jira-javascript/master/custom-jira.js', function() {
    try {
        window.cj = AJS.CustomJira();
    } catch (e) {
        console.warn("Skipping CustomJira in announcement banner, error: ", e);
    }
});
</script>
```

You can also look at the included [announcement-banner.js](announcement-banner.js) to see more advanced example of using [custom-jira.js](custom-jira.js)

## Features

Out of the box [custom-jira.js](custom-jira.js) provides the following features - all only apply when viewing Epic Issue types

- Adds New "Time Tracking" section on right pane that summarizes all estimated, remaining, logged time for all Issues in Epic including their subtasks.  
  -  Upper right has little box icon.  If scriptRunner add-on is installed, you can click to see JQL with time summary. 
- Updates Issues in Epic table
  - Re-orders list of issues based on any JQL Order By - for example, see [announcement-banner.js](announcement-banner.js)
  - Adds new Priority Column, hover over icon to get time tracking info for that issue
  - Adds "xx of yy Resolved" at top right. When clicked, will open new window with the Issues in Epic 

<img src="https://github.com/chadn/custom-jira-javascript/blob/master/custom-jira-epic-annotated.png" width="630" height="411" alt="Jira Epic Issue showing new features">


