# Strava Post-Ride Carb Calculator

A small userscript that adds an **immediate post-ride carbohydrate recommendation** directly to the Strava activity page.

It reads the following values from the page (via the **Strava Sauce** extension):

- **Moving Time**
- **TSS**
- **Body Weight**

The script then calculates the recommended carbohydrate intake to ingest **within ~10 minutes after the ride**, based on ride duration and training stress.

The result is displayed inline under the activity stats.

Example output:


Carbs (<10 min): 63–71 g
TSS/h 48.1 | 0.8–0.9 g/kg


---

# Background

The carbohydrate recommendation logic is based on the lookup table described in this video (starting around the linked timestamp):

https://www.youtube.com/watch?v=tOenzkgYd9k&t=135s

The script calculates:


TSS per hour = TSS / (ride duration in hours)


It then uses a **duration + TSS/h lookup table** to determine a **g/kg carbohydrate recommendation**, which is multiplied by rider body weight.

---

# Requirements

This script **requires the Strava Sauce browser extension**, because it provides the values the script reads:

- **TSS**
- **Weight**
- **FTP / power metrics**

Without Sauce the script will not find the required fields.

Strava Sauce:

https://www.sauce.llc/

---

# Installation

1. Install a userscript manager:

- Violentmonkey  
- Tampermonkey  
- Greasemonkey  

2. Install **Strava Sauce**.

3. Install the script by opening the raw userscript URL:


https://raw.githubusercontent.com/martinaasa/strava-carb-calculator/main/strava-carb-calculator.user.js


Your userscript manager should detect the script and prompt for installation.

---

# How it works

The script:

1. Reads activity data from the Strava DOM (Moving Time, TSS, Weight).
2. Calculates **TSS per hour**.
3. Looks up the carbohydrate recommendation from the lookup table.
4. Displays the result as an extra row under the Sauce stats.

The script runs only on:


https://www.strava.com/activities/
*


It observes the activity stats container and updates automatically if values change (for example when editing Sauce fields such as weight).

---

# Disclaimer

This is a **vibe-coded side project** written for personal use.

The script depends on the current HTML structure of both **Strava** and **Strava Sauce**, so it may break if either of them changes their layout.
