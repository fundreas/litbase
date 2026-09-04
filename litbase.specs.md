# Litbase

So i want to create a singel-page-application (SPA) that consumes the kickbase API (see apidog: "https://share.apidog.com/bca1f84a-99d7-4f8f-96a5-5e084ee24fe3/get-v4competitionscompetitionidplayers-29817174e0").

So the plan is, that a user logs-in with normal kickbase credentials. Then it fetches a token using the login-api and also handles the token-refreshing in the background then. also save the token/refresh token to the local-storage, so the user does not need to login over and over again when closing/opening the page!

From here on i think it would be nice to have any kind of different pages, consuming the kickbase API. This will be defined then in future.

## Project setup
So i want you to setup a typescrtipt react project. Use react-router and all the base dependencies we need. (no special state-management -> we just use normal contexts and hooks and states and reacts native eco-system!).

But the application should be also usable on Phone (mainly). So ensure that we use proper UI elements that work also on phone! Also use the react-query for API calls and axios. i want you to setup all the midleware and infrastructure stuff and the base-layout for the application so i can then concentrate on implementing the single pages!

So also think of some kind of menu/navigation-bar or something like that to navigate between different pages!

For the base-layout: Use a header-bar:
  - RHS the users-avatar. clicking opens a dropdown with a Logout Action
  - then we always should be in the context of one specific League. So think of a way how to select the league for some player (league-id should also be in the URL persisted for refreshing).
  i think on the LHS a three-line-menu icon that opens a side-bar menu would be the best approach for showing then the navigation to different pages.


# In Progress

# Duell Page

Here we show for some matchday X of the league-competition all duells of the managers in the league.
First on page we see the selected matchday. clicking it opens a drawer to select another matchday. Default is the current one from the competition!
then we show each duell:
  - if the matchday already started: we show the live points as sub-title for each manager
  - otherwise we just show the current ranking of the manager as sub-title

## Duell Details
now when clicking on some duell item in the duells-page -> the user gets navigated to the duel-details page:
  - different views/tabs: lineup, ranking
  - lineup: show both players lineup:
     - status: open/bench/playing/ausgewechselt/finished
     - points
  - show players from both managers mixed ranked by their points
  - also show the totals of the managers + active matches of players + open matches of players

# run on matchday as host
VITE_NOW=2026-08-29T16:45:00+02:00 npm run dev:live:host


# TODO

# Find out how match-updates work and how to fetch live-points/events for a player/team/manager


# Live Match Points
  - show the match details (goals, minute, events)
  - show the lineup with live points and the manager owning a player

# Duell Page
  - how to get the squad+lineup as matchday snapshot?
    ANSWERED (2026-09-04, verified live):
    GET /v4/leagues/{leagueId}/users/{userId}/teamcenter?dayNumber={n}
    - dayNumber is required and honoured; returns that matchday's squad, not today's
    - works for ANY manager in the league, not just the signed-in one
    - lp = the eleven that was fielded, nlp = the rest
    - note the spelling: users/{id}/teamcenter, NOT managers/{id}/squad
      (that one accepts ?dayNumber= and silently ignores it)
    - empty lp+nlp for out-of-range days and for matchdays before the league existed
    -> not wired up yet: would fix the duel page's past-matchday compromise and
       let the squad page's Live view work for past matchdays too

# Transfermarkt

# Manager Details

# Team Details

# Squad -> Live Tab when matchday is active