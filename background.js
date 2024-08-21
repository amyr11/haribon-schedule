chrome.runtime.onInstalled.addListener(() => {
	chrome.action.setBadgeText({ text: "OFF" });
});

const schedule_tab = 'https://web1.plm.edu.ph/crs/studentaccess/enlistment_view.php';

chrome.action.onClicked.addListener(async (tab) => {
	if (tab.url.startsWith(schedule_tab)) {
		await chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });

		// Inject content script to extract schedule data
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			function: extractScheduleData
		}, (results) => {
			// Send extracted data to popup
			const scheduleData = results[0].result;
			chrome.storage.local.set({ scheduleData: scheduleData }, () => {
				// Open the popup
				chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
				chrome.action.openPopup();
			});
		});
	} else {
		await chrome.action.setBadgeText({ tabId: tab.id, text: "OFF" });
		chrome.action.setPopup({ tabId: tab.id, popup: 'invalid.html' });
		chrome.action.openPopup();
	}
});

// Function to be injected into the webpage
function extractScheduleData() {
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

	return scheduleData;
}
