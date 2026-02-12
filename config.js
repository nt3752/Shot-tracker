// config.js
// Edit this file to add/remove clubs and shot types.
// Clubs are the short codes used in the UI and CSV (e.g., D, 3W, 7I, PW, PT).
// Shot types are lowercase keys (full, pitch, chip, putt).

window.APP_CONFIG = {
  clubs: ["D","3W","5W","7W","4I","5I","6I","7I","8I","9I","PW","GW","SW","LW","PT"],
  shotTypes: ["full","pitch","chip","putt","penalty"],
  defaults: {
    club: "Club?",
    shotType: "full"
  }
};
