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
    DONE -> Match Day page + Match Details, see docs/pages/matchday.md and
    docs/pages/match-detail.md.
      /leagues/:leagueId/matchday                   ?day=N, all fixtures, live
      /leagues/:leagueId/matchday/:matchId          Events (timeline)
      /leagues/:leagueId/matchday/:matchId/lineup   Aufstellung (pitch)
      /leagues/:leagueId/matchday/:matchId/ranking  Ranking (all players)
    - goals/minute/events all come from GET /v4/matches/{mi}/details, the same
      cache entry useLiveMatches already fills -> opening a match is free.
    - owner per player = the MATCHDAY SNAPSHOT, ONE REQUEST PER MANAGER:
        GET /v4/leagues/$L/users/$U/teamcenter?dayNumber=$N   for every $U
      `lp` = his lineup that matchday, `nlp` = the rest of his squad. Both are
      read, so the badge distinguishes "aufgestellt" from "im Kader, nicht
      aufgestellt". 10-20 requests, same cache entry as useMatchdaySquad.
      TWO CHEAPER ANSWERS WERE BOTH WRONG, both looked right:
        - `oui` on the player detail = who owns him TODAY. A past matchday
          credited every transferred player to his new manager.
        - `us` on this very payload = every manager with the players in their
          lineup, and it IGNORES dayNumber -> reports the CURRENT elevens
          whatever day is asked for. This is what produced "it's still the
          current lineup".
      Only the addressed manager's own lp/nlp honours dayNumber.
      `oui` survives as the last resort, for a matchday the snapshot has
      nothing at all for.
    - points = ~36 requests per match (one per player), and only while the
      Aufstellung/Ranking tabs are open. They poll at 60s while the match runs,
      so points and the Ranking order move live.
    - LIVE UPDATES: score/minute/events poll at 10s while running, and so do
      the per-player points (per player, only while HIS match is running).
      One constant: src/api/polling.ts. The season fixture list stays at 60s —
      it is the whole season fetched for one boolean (`st`).
      COST: a full fixture is ~36 player requests every 10s while the
      Aufstellung/Ranking tab is open. Bounded (stops at the final whistle,
      pauses in an unfocused tab) but it is the app's heaviest traffic. The catch
      that had to be fixed: refetchInterval is re-evaluated only on a refetch
      or an observer re-render, so `false` before kickoff is a DEAD END — a
      page open at 20:29 still said 18:30 at 20:45, and the fixture-list query
      that decides "is a matchday live" could not wake up either because the
      match query that would re-render it was asleep too. Both now watch the
      clock from 10 min before a kickoff, which starts everything.
    - OPEN PROBE: match-level events carry `pi: "0"` and their `ke` codes are
      NOT on the player scale (1=goal, 4=yellow, 8=sub, ...). Unknown, so
      Anpfiff/Halbzeit/Abpfiff are derived from the fixture's own state instead.
      One read of a `pi: "0"` entry's `ke` during/after a match settles it:
        KB "/v4/matches/$MI/details" | jq -c '[.events[]|select(.pi=="0")|{ke,mt,pn}]'

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
    - CAVEAT (measured): lp is EMPTY until the matchday starts. 6h before kickoff:
      lp=[] and nlp=all 15, while squad showed 11 fielded with lo 0..10.
      So the snapshot is only complete once a matchday is finished.
    -> WIRED UP (useMatchdaySquad) on BOTH the duel page and the squad Live view.
       canUseMatchdaySquad(): use the snapshot as soon as its lineup looks
       complete (settled matchday: always; running: only once lp >= today's
       fielded count), else fall back to today's lo. An earlier gate required
       the matchday to be FINISHED, which meant live matchdays and everything
       under dev:live fell back to today's squad — the data was there and the
       app refused it.
       Positions come from today's squad (snapshot has no reliable `pos`);
       points still come from ph[day-1].
    - NEXT PROBE (during a running matchday): does lp hold all 11, or only the
      players whose match has kicked off?
        KB "/v4/leagues/$L/users/$U/teamcenter?dayNumber=$CURRENT" | jq -c '{lp:(.lp|length),nlp:(.nlp|length)}'
      lp=11 -> snapshot can be the single source everywhere and lo drops out.

# Transfermarkt

# Manager Details

# Team Details
  DONE -> Club page, see docs/pages/team.md
    /leagues/:leagueId/teams/:teamId            Übersicht
    /leagues/:leagueId/teams/:teamId/squad      Kader
    /leagues/:leagueId/teams/:teamId/matches    Spiele
    /leagues/:leagueId/teams/:teamId/live       Live, only while that club plays
  - reached by tapping a CREST: the player header's, and either side of a
    match's scoreline. No drawer entry — a club page has eighteen subjects.
  - the point of the page is the JOIN with your league, not the football:
    who owns these players, what they cost, who is collecting their points.
  - COST, and the reason for the tab split:
      Übersicht  free — table + matchdays + competition players, all shared
                 1h caches the squad/matchday pages have already filled
      Kader      ~26 requests, /leagues/$L/players/$P per player. The ONLY
                 source of mv + prob + st/stxt + oui, no bulk spelling exists
      Spiele     the SAME fan-out: ph on each response is that player's whole
                 season, so it also yields the club's points per matchday.
                 Nothing else in the API answers "where were this club's
                 points". Flicking Kader <-> Spiele is free.
      Live       useMatchLineup, ~36 players polling — same cache entries the
                 match page fills, so arriving from there costs nothing
  - `oui` is the RIGHT owner here (owns him today) and the wrong one on a
    match page. TeamSquadOwner is literally MatchPlayerOwner with
    source:'currentOwner', so OwnerBadge/ownerLabel are reused verbatim.
  - plpim finally has a home: it is a whole-TEAM poster, identical for all 25
    players, which is why it failed as a per-player badge and works here.
  - matchdayEntry() is now exported from useMatchdayPoints — the ph index is
    newest-first off the payload's own `day`, and a second copy of that
    arithmetic is the off-by-one that already shipped once.

# Squad -> Live Tab when matchday is active