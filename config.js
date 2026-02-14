// config.js
// Edit this file to add/remove clubs and shot types.
// Clubs are the short codes used in the UI and CSV (e.g., D, 3W, 7I, PW, PT).
// Shot types are lowercase keys (full, pitch, chip, putt).

window.APP_CONFIG = {
  clubs: ["D","MD","3W","5W","7W","3H","5H","4I","5I","6I","7I","8I","9I","PW","46","56","60","PT"],
  shotTypes: ["Type?","3/4","1/2","full","pitch","chip","putt","penalty"],
  defaults: {
    club: "Club?",
    shotType: "Type?"
  },
  // Bag matrix: expected carry/total distances by club and shot type.
  // Edit these numbers (yards) as you learn your distances.
  bagMatrix: {
  "D": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "MD": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "3W": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "5W": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "7W": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "3H": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "5H": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "4I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "5I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "6I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "7I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "8I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "9I": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "PW": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "46": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "56": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  },
  "60": {
    "3/4": {
      "carry": 0,
      "total": 0
    },
    "1/2": {
      "carry": 0,
      "total": 0
    },
    "full": {
      "carry": 0,
      "total": 0
    },
    "pitch": {
      "carry": 0,
      "total": 0
    },
    "chip": {
      "carry": 0,
      "total": 0
    },
    "putt": {
      "carry": 0,
      "total": 0
    }
  }
}
};