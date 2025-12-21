// Declare map variable in global scope
var map;
var neighborhoodLayer;
var streetsLayer;
var selectedNeighborhood = null;

// ============================================================================
// GOOGLE CALENDAR FUNCTIONS
// ============================================================================

function createGoogleCalendarLink(
  streetName,
  side,
  startDateTime,
  endDateTime
) {
  // Format dates for Google Calendar (YYYYMMDDTHHMMSS format in UTC)
  const startFormatted = formatDateForGoogleCalendar(startDateTime);
  const endFormatted = formatDateForGoogleCalendar(endDateTime);

  // Create event title
  const title = encodeURIComponent("Street Cleaning Reminder");

  // Create event description
  const description = encodeURIComponent(
    `Car parked at ${streetName} on the ${side} side. ` +
      `Cleaning will begin ${formatDateForDescription(startDateTime)}.`
  );

  // Build Google Calendar URL
  const calendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&details=${description}` +
    `&dates=${startFormatted}/${endFormatted}`;

  return calendarUrl;
}

function formatDateForGoogleCalendar(date) {
  // Convert to YYYYMMDDTHHMMSSZ format (UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = "00";

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function formatDateForDescription(date) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
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
    "December",
  ];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const meridiem = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;
  const minutesStr = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";

  // Add ordinal suffix (st, nd, rd, th)
  const ordinal = getOrdinalSuffix(day);

  return `${dayName}, ${monthName} ${day}${ordinal} at ${hours}${minutesStr} ${meridiem}`;
}

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

// ============================================================================
// SCHEDULE CALCULATION FUNCTIONS
// ============================================================================

function calculateNextSweeping(schedule) {
  const now = new Date();

  if (!schedule || !schedule.day) {
    return {
      next: "Not available",
      until: "Not available",
      nextDate: null,
      untilDate: null,
    };
  }

  const dayOfWeek = schedule.day;
  const weekOfMonth = schedule.week;
  const startTime = schedule.start_time;
  const endTime = schedule.end_time;
  const frequency = schedule.frequency;

  let nextDate = null;

  if (frequency === "biweekly") {
    nextDate = findNextBiweeklyOccurrence(now, dayOfWeek, weekOfMonth);
  } else if (frequency === "weekly") {
    nextDate = findNextWeeklyOccurrence(now, dayOfWeek);
  } else if (frequency === "monthly") {
    nextDate = findNextMonthlyOccurrence(now, dayOfWeek, weekOfMonth);
  }

  if (!nextDate) {
    return {
      next: "Not available",
      until: "Not available",
      nextDate: null,
      untilDate: null,
    };
  }

  const nextDateTime = parseDateWithTime(nextDate, startTime);
  const untilDateTime = parseDateWithTime(nextDate, endTime);

  return {
    next: formatDateTime(nextDateTime),
    until: formatDateTime(untilDateTime),
    nextDate: nextDateTime,
    untilDate: untilDateTime,
  };
}

function findNextBiweeklyOccurrence(fromDate, dayOfWeek, weekOfMonth) {
  const targetDayIndex = getDayIndex(dayOfWeek);
  const weeks = parseWeeks(weekOfMonth);

  let date = new Date(fromDate);
  for (let week of weeks) {
    const candidate = getNthWeekdayOfMonth(
      date.getFullYear(),
      date.getMonth(),
      targetDayIndex,
      week
    );
    if (candidate > fromDate) return candidate;
  }

  date.setMonth(date.getMonth() + 1);
  for (let week of weeks) {
    const candidate = getNthWeekdayOfMonth(
      date.getFullYear(),
      date.getMonth(),
      targetDayIndex,
      week
    );
    if (candidate > fromDate) return candidate;
  }

  return null;
}

function findNextWeeklyOccurrence(fromDate, dayOfWeek) {
  const targetDayIndex = getDayIndex(dayOfWeek);
  const date = new Date(fromDate);

  while (date.getDay() !== targetDayIndex || date <= fromDate) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function findNextMonthlyOccurrence(fromDate, dayOfWeek, weekOfMonth) {
  const targetDayIndex = getDayIndex(dayOfWeek);
  const week = parseInt(weekOfMonth.replace(/[^\d]/g, ""));

  let date = new Date(fromDate);
  let candidate = getNthWeekdayOfMonth(
    date.getFullYear(),
    date.getMonth(),
    targetDayIndex,
    week
  );

  if (candidate > fromDate) return candidate;

  date.setMonth(date.getMonth() + 1);
  return getNthWeekdayOfMonth(
    date.getFullYear(),
    date.getMonth(),
    targetDayIndex,
    week
  );
}

function getNthWeekdayOfMonth(year, month, dayOfWeek, n) {
  const date = new Date(year, month, 1);
  let count = 0;

  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === n) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return null;
}

function getDayIndex(dayName) {
  const days = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  return days[dayName.toLowerCase()] || 0;
}

function parseWeeks(weekStr) {
  if (!weekStr) return [];
  const weeks = [];
  const parts = weekStr.toLowerCase().split(",");

  for (let part of parts) {
    part = part.trim();
    if (part.includes("1st") || part === "1") weeks.push(1);
    if (part.includes("2nd") || part === "2") weeks.push(2);
    if (part.includes("3rd") || part === "3") weeks.push(3);
    if (part.includes("4th") || part === "4") weeks.push(4);
  }

  return weeks;
}

function parseDateWithTime(date, timeStr) {
  const newDate = new Date(date);
  const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);

  if (timeParts) {
    let hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2]);
    const meridiem = timeParts[3].toUpperCase();

    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    newDate.setHours(hours, minutes, 0, 0);
  }

  return newDate;
}

function formatDateTime(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
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
    "Dec",
  ];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const meridiem = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, "0");

  return `${dayName}, ${monthName} ${day}, ${hours}:${minutesStr} ${meridiem}`;
}

// ============================================================================
// MAP FUNCTIONS
// ============================================================================

function initializeMap() {
  map = L.map("map").setView([34.0619, -118.3467], 12);
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  ).addTo(map);
}

function loadNeighborhoodStreets(neighborhoodName) {
  if (streetsLayer) {
    map.removeLayer(streetsLayer);
    streetsLayer = null;
  }

  var filename = neighborhoodName.toLowerCase().replace(/\s+/g, "");
  var filepath = `data/neighborhoods/${filename}.geojson`;

  fetch(filepath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Neighborhood data not found: ${neighborhoodName}`);
      }
      return response.json();
    })
    .then((data) => {
      // Process each feature to calculate dynamic dates
      data.features.forEach((feature) => {
        const props = feature.properties;

        // Helper function to parse schedule (handles both string and object)
        function parseSchedule(schedule) {
          if (!schedule) return null;

          // If it's a string, try to parse it as JSON
          if (typeof schedule === "string") {
            try {
              // Remove trailing comma if present
              const cleanedSchedule = schedule.trim().replace(/,\s*$/, "");
              return JSON.parse(cleanedSchedule);
            } catch (e) {
              console.error("Error parsing schedule:", e);
              return null;
            }
          }

          // If it's already an object, return it
          return schedule;
        }

        // Calculate north side dates
        if (props.north_schedule) {
          const northSchedule = parseSchedule(props.north_schedule);
          if (northSchedule) {
            props.north_schedule = northSchedule; // Replace string with parsed object
            const northDates = calculateNextSweeping(northSchedule);
            props.north_next = northDates.next;
            props.north_until = northDates.until;
            props.north_next_date = northDates.nextDate;
            props.north_until_date = northDates.untilDate;
          }
        }

        // Calculate south side dates
        if (props.south_schedule) {
          const southSchedule = parseSchedule(props.south_schedule);
          if (southSchedule) {
            props.south_schedule = southSchedule;
            const southDates = calculateNextSweeping(southSchedule);
            props.south_next = southDates.next;
            props.south_until = southDates.until;
            props.south_next_date = southDates.nextDate;
            props.south_until_date = southDates.untilDate;
          }
        }

        // Calculate east side dates
        if (props.east_schedule) {
          const eastSchedule = parseSchedule(props.east_schedule);
          if (eastSchedule) {
            props.east_schedule = eastSchedule;
            const eastDates = calculateNextSweeping(eastSchedule);
            props.east_next = eastDates.next;
            props.east_until = eastDates.until;
            props.east_next_date = eastDates.nextDate;
            props.east_until_date = eastDates.untilDate;
          }
        }

        // Calculate west side dates
        if (props.west_schedule) {
          const westSchedule = parseSchedule(props.west_schedule);
          if (westSchedule) {
            props.west_schedule = westSchedule;
            const westDates = calculateNextSweeping(westSchedule);
            props.west_next = westDates.next;
            props.west_until = westDates.until;
            props.west_next_date = westDates.nextDate;
            props.west_until_date = westDates.untilDate;
          }
        }
      });

      // Create the streets layer
      streetsLayer = L.geoJSON(data, {
        style: function (feature) {
          return {
            color: "#FF6B6B",
            weight: 4,
            opacity: 0.8,
            fillColor: "#2a2a2a",
            fillOpacity: 0.15,
          };
        },
        onEachFeature: function (feature, layer) {
          layer.on("click", function (e) {
            L.DomEvent.stopPropagation(e);

            var lat = e.latlng.lat.toFixed(6);
            var lng = e.latlng.lng.toFixed(6);

            var streetName =
              feature.properties.name ||
              feature.properties.NAME ||
              "Unknown Street";

            var props = feature.properties;

            // Build popup sections dynamically based on what's available
            var sections = [];

            // Check for North/South schedule (typical for north-south streets)
            if (props.north_next || props.north_schedule) {
              var northNext = props.north_next || "Not available";
              var northUntil = props.north_until || "Not available";

              // Create Google Calendar link if dates are available
              var calendarButton = "";
              if (props.north_next_date && props.north_until_date) {
                const calendarLink = createGoogleCalendarLink(
                  streetName,
                  "North",
                  props.north_next_date,
                  props.north_until_date
                );
                calendarButton = `
                  <a href="${calendarLink}" target="_blank" 
                     style="display: inline-block; margin-top: 8px; background: #4A5BC4; color: white; 
                            text-decoration: none; padding: 8px 16px; border-radius: 4px; 
                            font-size: 12px; font-weight: 600; transition: background 0.2s;"
                     onmouseover="this.style.background='#3a4ba4'"
                     onmouseout="this.style.background='#4A5BC4'">
                    📅 Add to Calendar
                  </a>
                `;
              }

              sections.push(`
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                  <h4 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px;">North Side</h4>
                  <div style="font-size: 13px;">
                    <strong>Next:</strong> ${northNext}<br>
                    <strong>Until:</strong> ${northUntil}
                  </div>
                  ${
                    props.north_schedule
                      ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                      <strong>Pattern:</strong> ${
                        props.north_schedule.frequency || ""
                      } - ${props.north_schedule.day || ""} 
                      ${
                        props.north_schedule.week
                          ? "(" + props.north_schedule.week + " week)"
                          : ""
                      }<br>
                      <strong>Time:</strong> ${
                        props.north_schedule.start_time || ""
                      } - ${props.north_schedule.end_time || ""}
                    </div>
                  `
                      : ""
                  }
                  ${calendarButton}
                </div>
              `);
            }

            if (props.south_next || props.south_schedule) {
              var southNext = props.south_next || "Not available";
              var southUntil = props.south_until || "Not available";

              var calendarButton = "";
              if (props.south_next_date && props.south_until_date) {
                const calendarLink = createGoogleCalendarLink(
                  streetName,
                  "South",
                  props.south_next_date,
                  props.south_until_date
                );
                calendarButton = `
                  <a href="${calendarLink}" target="_blank" 
                     style="display: inline-block; margin-top: 8px; background: #4A5BC4; color: white; 
                            text-decoration: none; padding: 8px 16px; border-radius: 4px; 
                            font-size: 12px; font-weight: 600; transition: background 0.2s;"
                     onmouseover="this.style.background='#3a4ba4'"
                     onmouseout="this.style.background='#4A5BC4'">
                    📅 Add to Calendar
                  </a>
                `;
              }

              sections.push(`
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                  <h4 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px;">South Side</h4>
                  <div style="font-size: 13px;">
                    <strong>Next:</strong> ${southNext}<br>
                    <strong>Until:</strong> ${southUntil}
                  </div>
                  ${
                    props.south_schedule
                      ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                      <strong>Pattern:</strong> ${
                        props.south_schedule.frequency || ""
                      } - ${props.south_schedule.day || ""} 
                      ${
                        props.south_schedule.week
                          ? "(" + props.south_schedule.week + " week)"
                          : ""
                      }<br>
                      <strong>Time:</strong> ${
                        props.south_schedule.start_time || ""
                      } - ${props.south_schedule.end_time || ""}
                    </div>
                  `
                      : ""
                  }
                  ${calendarButton}
                </div>
              `);
            }

            // Check for East/West schedule (typical for east-west streets)
            if (props.east_next || props.east_schedule) {
              var eastNext = props.east_next || "Not available";
              var eastUntil = props.east_until || "Not available";

              var calendarButton = "";
              if (props.east_next_date && props.east_until_date) {
                const calendarLink = createGoogleCalendarLink(
                  streetName,
                  "East",
                  props.east_next_date,
                  props.east_until_date
                );
                calendarButton = `
                  <a href="${calendarLink}" target="_blank" 
                     style="display: inline-block; margin-top: 8px; background: #4A5BC4; color: white; 
                            text-decoration: none; padding: 8px 16px; border-radius: 4px; 
                            font-size: 12px; font-weight: 600; transition: background 0.2s;"
                     onmouseover="this.style.background='#3a4ba4'"
                     onmouseout="this.style.background='#4A5BC4'">
                    📅 Add to Calendar
                  </a>
                `;
              }

              sections.push(`
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                  <h4 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px;">East Side</h4>
                  <div style="font-size: 13px;">
                    <strong>Next:</strong> ${eastNext}<br>
                    <strong>Until:</strong> ${eastUntil}
                  </div>
                  ${
                    props.east_schedule
                      ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                      <strong>Pattern:</strong> ${
                        props.east_schedule.frequency || ""
                      } - ${props.east_schedule.day || ""} 
                      ${
                        props.east_schedule.week
                          ? "(" + props.east_schedule.week + " week)"
                          : ""
                      }<br>
                      <strong>Time:</strong> ${
                        props.east_schedule.start_time || ""
                      } - ${props.east_schedule.end_time || ""}
                    </div>
                  `
                      : ""
                  }
                  ${calendarButton}
                </div>
              `);
            }

            if (props.west_next || props.west_schedule) {
              var westNext = props.west_next || "Not available";
              var westUntil = props.west_until || "Not available";

              var calendarButton = "";
              if (props.west_next_date && props.west_until_date) {
                const calendarLink = createGoogleCalendarLink(
                  streetName,
                  "West",
                  props.west_next_date,
                  props.west_until_date
                );
                calendarButton = `
                  <a href="${calendarLink}" target="_blank" 
                     style="display: inline-block; margin-top: 8px; background: #4A5BC4; color: white; 
                            text-decoration: none; padding: 8px 16px; border-radius: 4px; 
                            font-size: 12px; font-weight: 600; transition: background 0.2s;"
                     onmouseover="this.style.background='#3a4ba4'"
                     onmouseout="this.style.background='#4A5BC4'">
                    📅 Add to Calendar
                  </a>
                `;
              }

              sections.push(`
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                  <h4 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px;">West Side</h4>
                  <div style="font-size: 13px;">
                    <strong>Next:</strong> ${westNext}<br>
                    <strong>Until:</strong> ${westUntil}
                  </div>
                  ${
                    props.west_schedule
                      ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                      <strong>Pattern:</strong> ${
                        props.west_schedule.frequency || ""
                      } - ${props.west_schedule.day || ""} 
                      ${
                        props.west_schedule.week
                          ? "(" + props.west_schedule.week + " week)"
                          : ""
                      }<br>
                      <strong>Time:</strong> ${
                        props.west_schedule.start_time || ""
                      } - ${props.west_schedule.end_time || ""}
                    </div>
                  `
                      : ""
                  }
                  ${calendarButton}
                </div>
              `);
            }

            // If no sections were created, show a default message
            if (sections.length === 0) {
              sections.push(`
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #ffc107;">
                  <p style="margin: 0; color: #856404; font-size: 13px;">
                    No street sweeping schedule available for this street.
                  </p>
                </div>
              `);
            }

            var popupContent = `
              <div style="font-family: Arial, sans-serif; max-width: 450px;">
                <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px; border-bottom: 2px solid #4A5BC4; padding-bottom: 10px;">
                  ${streetName}
                </h3>

                ${sections.join("")}
              </div>
            `;

            L.popup({
              maxWidth: 450,
              className: "street-info-popup",
            })
              .setLatLng(e.latlng)
              .setContent(popupContent)
              .openOn(map);
          });

          layer.on({
            mouseover: function (e) {
              e.target.setStyle({
                weight: 6,
                opacity: 1,
                fillOpacity: 0.25,
              });
            },
            mouseout: function (e) {
              e.target.setStyle({
                weight: 4,
                opacity: 0.8,
                fillOpacity: 0.15,
              });
            },
          });
        },
      }).addTo(map);
    })
    .catch((error) => {
      console.error("Error loading neighborhood streets:", error);
      alert(`Could not load street data for ${neighborhoodName}`);
    });
}

function loadNeighborhoods() {
  fetch("/data/neighborhoods/LA_Times_Neighborhood_Boundaries.geojson")
    .then((response) => response.json())
    .then((data) => {
      if (neighborhoodLayer) {
        map.removeLayer(neighborhoodLayer);
      }

      neighborhoodLayer = L.geoJSON(data, {
        style: function (feature) {
          return {
            color: "#4A5BC4",
            weight: 0,
            opacity: 0,
            fillColor: "#4A5BC4",
            fillOpacity: 0.1,
          };
        },
        onEachFeature: function (feature, layer) {
          var neighborhoodName =
            feature.properties.name ||
            feature.properties.NAME ||
            "Unknown Neighborhood";

          layer.neighborhoodName = neighborhoodName;

          layer.originalMouseover = function (e) {
            if (selectedNeighborhood !== layer) {
              layer.setStyle({
                weight: 3,
                opacity: 0.6,
                fillOpacity: 0.3,
              });
            }
          };

          layer.originalMouseout = function (e) {
            if (selectedNeighborhood !== layer) {
              layer.setStyle({
                weight: 0,
                opacity: 0,
                fillOpacity: 0.1,
              });
            }
          };

          layer.bindTooltip(neighborhoodName, {
            permanent: false,
            direction: "center",
            className: "neighborhood-tooltip",
          });

          layer.on({
            mouseover: layer.originalMouseover,
            mouseout: layer.originalMouseout,
            click: function (e) {
              if (selectedNeighborhood === layer) {
                layer.setStyle({
                  weight: 0,
                  opacity: 0,
                  fillOpacity: 0.1,
                });

                if (streetsLayer) {
                  map.removeLayer(streetsLayer);
                  streetsLayer = null;
                }

                layer.on("mouseover", layer.originalMouseover);
                layer.on("mouseout", layer.originalMouseout);

                layer.bindTooltip(layer.neighborhoodName, {
                  permanent: false,
                  direction: "center",
                  className: "neighborhood-tooltip",
                });

                selectedNeighborhood = null;
              } else {
                if (selectedNeighborhood) {
                  selectedNeighborhood.setStyle({
                    weight: 0,
                    opacity: 0,
                    fillOpacity: 0.1,
                  });

                  selectedNeighborhood.on(
                    "mouseover",
                    selectedNeighborhood.originalMouseover
                  );
                  selectedNeighborhood.on(
                    "mouseout",
                    selectedNeighborhood.originalMouseout
                  );

                  selectedNeighborhood.bindTooltip(
                    selectedNeighborhood.neighborhoodName,
                    {
                      permanent: false,
                      direction: "center",
                      className: "neighborhood-tooltip",
                    }
                  );
                }

                layer.closeTooltip();
                layer.off("mouseover");
                layer.off("mouseout");
                layer.unbindTooltip();

                layer.setStyle({
                  weight: 3,
                  opacity: 0.6,
                  fillOpacity: 0.3,
                });

                selectedNeighborhood = layer;
                map.fitBounds(layer.getBounds());
                loadNeighborhoodStreets(neighborhoodName);
              }
            },
          });
        },
      }).addTo(map);
    })
    .catch((error) => console.error("Error loading neighborhoods:", error));
}

// Initialize everything
initializeMap();
loadNeighborhoods();
