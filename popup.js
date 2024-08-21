document.getElementById('exportBtn').addEventListener('click', () => {
	const startDate = document.getElementById('startDate').value;
	const endDate = document.getElementById('endDate').value;
	const alertDuration = parseInt(document.getElementById('alertDuration').value);
	const alertUnit = document.getElementById('alertUnit').value;

	if (!startDate || !endDate) {
		alert('Please select both start and end dates.');
		return;
	}

	if (isNaN(alertDuration) || alertDuration < 0) {
		alert('Please enter a valid alert duration.');
		return;
	}

	chrome.storage.local.get('scheduleData', (data) => {
		const scheduleData = data.scheduleData || [];

		if (scheduleData.length > 0) {
			// Convert alert duration to minutes
			const alertMinutes = alertUnit === 'hours' ? alertDuration * 60 : alertDuration;

			// Call a function to generate and download the ICS file
			exportSchedule(scheduleData, startDate, endDate, alertMinutes);

			window.close();
		} else {
			alert('No schedule data available.');
		}
	});
});

// This function runs in the context of the web page
function exportSchedule(scheduleData, startDate, endDate, alertMinutes) {
	function generateICS(events, startDate, endDate, alertMinutes) {
		let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n';

		events.forEach(event => {
			const startDateObj = new Date(startDate);
			const startDateDay = startDateObj.getDay();
			const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
			const dayIndex = days.indexOf(event.day);
			let daysToAdd = dayIndex - startDateDay;
			if (daysToAdd < 0) daysToAdd += 7;

			const eventDateObj = new Date(startDateObj);
			eventDateObj.setDate(startDateObj.getDate() + daysToAdd);

			if (eventDateObj > new Date(endDate)) return;

			const [startHour, startMinute] = event.startTime.split(':');
			const [endHour, endMinute] = event.endTime.split(':');

			const s_yyyy = eventDateObj.getFullYear();
			const s_mm = (eventDateObj.getMonth() + 1).toString().padStart(2, '0');
			const s_dd = eventDateObj.getDate().toString().padStart(2, '0');
			const s_hh = startHour;
			const s_mm_ = startMinute;
			const dtStart = `${s_yyyy}${s_mm}${s_dd}T${s_hh}${s_mm_}00Z`;

			const e_yyyy = eventDateObj.getFullYear();
			const e_mm = (eventDateObj.getMonth() + 1).toString().padStart(2, '0');
			const e_dd = eventDateObj.getDate().toString().padStart(2, '0');
			const e_hh = endHour;
			const e_mm_ = endMinute;
			const dtEnd = `${e_yyyy}${e_mm}${e_dd}T${e_hh}${e_mm_}00Z`;

			let eventIcsContent = 'BEGIN:VEVENT\r\n';
			eventIcsContent += `DTSTART;TZID=Asia/Manila:${dtStart}\r\n`;
			eventIcsContent += `DTEND;TZID=Asia/Manila:${dtEnd}\r\n`;
			eventIcsContent += `SUMMARY:${event.className} ${event.section}\r\n`;
			eventIcsContent += `LOCATION:${event.place}\r\n`;
			eventIcsContent += `DESCRIPTION:Section ${event.section} - ${event.credits} units\r\n`;

			// Add alert option
			if (alertMinutes > 0) {
				let alarmTrigger = `-PT${alertMinutes}M`;
				eventIcsContent += `BEGIN:VALARM\r\nTRIGGER:${alarmTrigger}\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\n`;
			}

			eventIcsContent += `RRULE:FREQ=WEEKLY;BYDAY=${event.day};UNTIL=${endDate.replace(/-/g, '')}T235959Z\r\n`; // Recurrence rule with end date
			eventIcsContent += 'END:VEVENT\r\n';

			icsContent += eventIcsContent;
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

	const icsContent = generateICS(scheduleData, startDate, endDate, alertMinutes);
	downloadICS(icsContent, 'schedule.ics');
}
