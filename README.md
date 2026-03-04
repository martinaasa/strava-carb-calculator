# Strava Post-Ride Carb Calculator

A small userscript that adds an **immediate post-ride carbohydrate recommendation** directly to the Strava activity page.

It reads the following values from the page (via the **Strava Sauce** extension):

- **Moving Time**
- **TSS**
- **Body Weight**

Then it calculates the recommended carbohydrate intake to ingest **within ~10 minutes after the ride**, based on ride duration and training stress, and displays the result inline under the activity stats.

Example output:

```

Carbs (<10 min): 63–71 g
TSS/h 48.1 | 0.8–0.9 g/kg

```

## Background

The carbohydrate recommendation logic is based on the lookup table described in this video (starting around the linked timestamp):

https://www.youtube.com/watch?v=tOenzkgYd9k&t=135s

The script calculates:

```

TSS per hour = TSS / (ride duration in hours)

```

It then uses a **duration + TSS/h lookup table** to determine a **g/kg carbohydrate range**, which is multiplied by rider body weight.

## Requirements

This script **requires the Strava Sauce browser extension** because it provides the values the script reads:

- **TSS**
- **Weight**
- **FTP / power metrics** (not required for the calculation, but Sauce is the source of the fields)

Without Sauce the script will not find the required fields.

Strava Sauce:

https://www.sauce.llc/

## Installation

1. Install a userscript manager:

- Violentmonkey  
- Tampermonkey  
- Greasemonkey  

2. Install **Strava Sauce**.

3. Install the script from the raw URL:

```

[https://raw.githubusercontent.com/](https://raw.githubusercontent.com/)<user>/<repo>/main/strava-carb-calculator.user.js

```

## How it works

The script:

1. Reads activity data from the Strava DOM (Moving Time, TSS, Weight).
2. Calculates **TSS per hour**.
3. Looks up the carbohydrate recommendation from the table.
4. Displays the result as an extra row under the Sauce stats.

It runs only on:

```

[https://www.strava.com/activities/](https://www.strava.com/activities/)*

```

It observes the stats container so it updates automatically if values change (for example when Sauce fields are edited).

## Disclaimer

This is a **vibe-coded side project** written for personal use.

The script relies on Strava’s current page structure and the Sauce extension, so it may break if either of them change their HTML layout.

## License

MIT License

Copyright (c) 2026 Martin Aasa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
