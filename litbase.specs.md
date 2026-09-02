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

