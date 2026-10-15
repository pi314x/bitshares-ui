// Vendored from the `counterpart` npm package's `strftime.js` (MIT
// licensed), as part of Phase 8's counterpart -> react-intl
// consolidation (docs/UI_MIGRATION_PLAN.md). This is a small,
// self-contained pure function with no dependency on counterpart's
// translation engine itself, so it is copied here verbatim (only the
// `date-names` package dependency is replaced with the same static
// English names data inlined - see counterpartShim.js's ENGLISH_NAMES,
// the only names this app's `.localize()` calls ever actually resolve
// to, since none of the app's 10 locale JSON files register a
// `counterpart.names` entry for any language - only `en` ever gets one,
// via this same English data, so every locale's dates already rendered
// with English month/day names before this port too - preserved
// verbatim, not "fixed").
"use strict";

function strftime(date, format, names) {
    const timestamp = date.getTime();

    names = names || strftime.defaultNames;

    return format.replace(/%([-_0]?.)/g, function(_, c) {
        let padding = null;

        if (c.length == 2) {
            switch (c[0]) {
                case "-":
                    padding = "";
                    break;
                case "_":
                    padding = " ";
                    break;
                case "0":
                    padding = "0";
                    break;
                default:
                    return _; // should never reach this one
            }

            c = c[1];
        }

        switch (c) {
            case "A":
                return names.days[date.getDay()];
            case "a":
                return names.abbreviated_days[date.getDay()];
            case "B":
                return names.months[date.getMonth()];
            case "b":
                return names.abbreviated_months[date.getMonth()];
            case "C":
                return pad(Math.floor(date.getFullYear() / 100), padding);
            case "D":
                return strftime(date, "%m/%d/%y", names);
            case "d":
                return pad(date.getDate(), padding);
            case "e":
                return date.getDate();
            case "F":
                return strftime(date, "%Y-%m-%d", names);
            case "H":
                return pad(date.getHours(), padding);
            case "h":
                return names.abbreviated_months[date.getMonth()];
            case "I":
                return pad(hours12(date), padding);
            case "j":
                return pad(
                    Math.ceil(
                        (date.getTime() -
                            new Date(date.getFullYear(), 0, 1).getTime()) /
                            (1000 * 60 * 60 * 24)
                    ),
                    3
                );
            case "k":
                return pad(date.getHours(), padding === null ? " " : padding);
            case "L":
                return pad(Math.floor(timestamp % 1000), 3);
            case "l":
                return pad(hours12(date), padding === null ? " " : padding);
            case "M":
                return pad(date.getMinutes(), padding);
            case "m":
                return pad(date.getMonth() + 1, padding);
            case "n":
                return "\n";
            case "o":
                return String(date.getDate()) + ordinal(date.getDate());
            case "P":
                return date.getHours() < 12
                    ? names.am.toLowerCase()
                    : names.pm.toLowerCase();
            case "p":
                return date.getHours() < 12
                    ? names.am.toUpperCase()
                    : names.pm.toUpperCase();
            case "R":
                return strftime(date, "%H:%M", names);
            case "r":
                return strftime(date, "%I:%M:%S %p", names);
            case "S":
                return pad(date.getSeconds(), padding);
            case "s":
                return Math.floor(timestamp / 1000);
            case "T":
                return strftime(date, "%H:%M:%S", names);
            case "t":
                return "\t";
            case "U":
                return pad(weekNumber(date, "sunday"), padding);
            case "u":
                return date.getDay() === 0 ? 7 : date.getDay();
            case "v":
                return strftime(date, "%e-%b-%Y", names);
            case "W":
                return pad(weekNumber(date, "monday"), padding);
            case "w":
                return date.getDay();
            case "Y":
                return date.getFullYear();
            case "y":
                var y = String(date.getFullYear());
                return y.slice(y.length - 2);
            case "Z":
                var tzString = date.toString().match(/\((\w+)\)/);
                return (tzString && tzString[1]) || "";
            case "z":
                var off = date.getTimezoneOffset();
                return (
                    (off > 0 ? "-" : "+") +
                    pad(Math.round(Math.abs(off / 60)), 2) +
                    ":" +
                    pad(off % 60, 2)
                );
            default:
                return c;
        }
    });
}

function pad(n, padding, length) {
    if (typeof padding === "number") {
        length = padding;
        padding = "0";
    }

    if (padding === null) {
        padding = "0";
    }

    length = length || 2;

    let s = String(n);

    if (padding) {
        while (s.length < length) {
            s = padding + s;
        }
    }

    return s;
}

function hours12(date) {
    let hour = date.getHours();

    if (hour === 0) {
        hour = 12;
    } else if (hour > 12) {
        hour -= 12;
    }

    return hour;
}

function ordinal(n) {
    const i = n % 10,
        ii = n % 100;

    if ((ii >= 11 && ii <= 13) || i === 0 || i >= 4) {
        return "th";
    }

    switch (i) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
    }
}

function weekNumber(date, firstWeekday) {
    firstWeekday = firstWeekday || "sunday";

    let wday = date.getDay();

    if (firstWeekday == "monday") {
        if (wday === 0) {
            // Sunday
            wday = 6;
        } else {
            wday--;
        }
    }

    const firstDayOfYear = new Date(date.getFullYear(), 0, 1),
        yday = (date - firstDayOfYear) / 86400000,
        weekNum = (yday + 7 - wday) / 7;

    return Math.floor(weekNum);
}

strftime.defaultNames = {
    days: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ],
    abbreviated_days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ],
    abbreviated_months: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ],
    am: "AM",
    pm: "PM"
};

module.exports = strftime;
