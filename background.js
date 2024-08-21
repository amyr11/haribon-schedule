chrome.runtime.onInstalled.addListener(() => {
	chrome.action.setBadgeText({
		text: "OFF",
	});
});

const schedule_tab = 'https://web1.plm.edu.ph/crs/studentaccess/enlistment_view.php';

chrome.action.onClicked.addListener(async (tab) => {
	if (tab.url.startsWith(schedule_tab)) {
		await chrome.action.setBadgeText({
			tabId: tab.id,
			text: "ON",
		});

		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			function: () => {
				const scheduleData = [];

				function convertTo24Hour(time) {
					const match = time.match(/(\d{1,2}):(\d{2})([ap])/i);
					if (!match) return time;
					let [_, hours, minutes, period] = match;
					hours = parseInt(hours, 10);
					if (period.toLowerCase() === 'p' && hours !== 12) {
						hours += 12;
					} else if (period.toLowerCase() === 'a' && hours === 12) {
						hours = 0;
					}
					return `${hours.toString().padStart(2, '0')}:${minutes}`;
				}

				function convertDayToCode(day) {
					const dayMapping = {
						'Su': 'SU',
						'M': 'MO',
						'T': 'TU',
						'W': 'WE',
						'Th': 'TH',
						'F': 'FR',
						'Sa': 'SA'
					};
					return dayMapping[day] || day;
				}

				function extractScheduleDetails(scheduleString) {
					const [day, timeRange, ...locationParts] = scheduleString.split(' ');
					if (!timeRange || !day) return {};
					const [startTime, endTime] = timeRange.split('-');
					const place = locationParts.join(' ');

					return {
						day: convertDayToCode(day),
						startTime: convertTo24Hour(startTime),
						endTime: convertTo24Hour(endTime),
						place
					};
				}

				const rows = document.querySelectorAll('tr.preregnotes');
				console.log(`Found ${rows.length} rows`);

				rows.forEach(row => {
					const className = row.cells[0]?.innerText.trim();
					const section = row.cells[1]?.innerText.trim();
					const schedule = row.cells[2]?.innerText.trim();
					const credits = row.cells[3]?.innerText.trim();

					if (className && section && schedule && credits) {
						const scheduleDetails = extractScheduleDetails(schedule);

						if (scheduleDetails.day) {
							scheduleData.push({ className, section, credits, ...scheduleDetails });
						}
					}
				});

				console.log(`Extracted ${scheduleData.length} events`);
				console.log(scheduleData);

				function generateICS(events) {
					let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n';

					events.forEach(event => {
						const today = new Date();
						const todayDay = today.getDay();
						const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
						const dayIndex = days.indexOf(event.day);
						let daysToAdd = dayIndex - todayDay;
						if (daysToAdd < 0) daysToAdd += 7;  // Move to next week if day is in the past

						const nextDate = new Date(today);
						nextDate.setDate(today.getDate() + daysToAdd);

						const startDate = new Date(nextDate);
						const endDate = new Date(nextDate);

						const [startHour, startMinute] = event.startTime.split(':');
						const [endHour, endMinute] = event.endTime.split(':');

						s_yyyy = startDate.getFullYear();
						s_mm = (startDate.getMonth() + 1).toString().padStart(2, '0');
						s_dd = startDate.getDate().toString().padStart(2, '0');
						s_hh = startHour
						s_mm_ = startMinute
						dtStart = `${s_yyyy}${s_mm}${s_dd}T${s_hh}${s_mm_}00Z`

						e_yyyy = endDate.getFullYear();
						e_mm = (endDate.getMonth() + 1).toString().padStart(2, '0');
						e_dd = endDate.getDate().toString().padStart(2, '0');
						e_hh = endHour
						e_mm_ = endMinute
						dtEnd = `${e_yyyy}${e_mm}${e_dd}T${e_hh}${e_mm_}00Z`

						eventIcsContent = ""

						eventIcsContent += 'BEGIN:VEVENT\r\n';
						eventIcsContent += `DTSTART;TZID=Asia/Manila:${dtStart}\r\n`; // Start date with timezone set to Manila
						eventIcsContent += `DTEND;TZID=Asia/Manila:${dtEnd}\r\n`; // End date with timezone set to Manila
						eventIcsContent += `SUMMARY:${event.className} ${event.section}\r\n`;
						eventIcsContent += `LOCATION:${event.place}\r\n`;
						eventIcsContent += `DESCRIPTION:Section ${event.section} - ${event.credits} units\r\n`;
						eventIcsContent += `RRULE:FREQ=WEEKLY;BYDAY=${event.day}\r\n`; // Recurrence rule
						eventIcsContent += 'END:VEVENT\r\n';

						icsContent += eventIcsContent

						console.log(event)
						console.log(eventIcsContent)
					});

					icsContent += 'END:VCALENDAR\r\n';
					return icsContent;
				}

				function downloadICS(content, filename) {
					const blob = new Blob([content], { type: 'text/calendar' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = filename;
					a.click();
					URL.revokeObjectURL(url);
				}

				const icsContent = generateICS(scheduleData);
				downloadICS(icsContent, 'schedule.ics');
			}
		});
	} else {
		await chrome.action.setBadgeText({
			tabId: tab.id,
			text: "OFF",
		});
	}
});
