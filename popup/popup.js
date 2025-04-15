document.addEventListener('DOMContentLoaded', () => {
    // Ensure the DOM is fully loaded

    const manageButton = document.getElementById('manageButton');

    if (manageButton) {
        manageButton.addEventListener('click', () => {
            // Check if the chrome.runtime API is available (it should be)
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                console.error("Chrome Runtime or openOptionsPage API not available.");
                // Fallback or error message for the user (rarely needed)
                alert("The management page could not be opened.");
            }
        });
    } else {
        console.error("Button with ID 'manageButton' not found in the popup.");
    }
});