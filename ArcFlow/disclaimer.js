(function () {
    var DISCLAIMER_KEY = 'arcflow_disclaimer_accepted';
    var overlay = document.getElementById('disclaimerModal');
    var checkbox = document.getElementById('disclaimerAgree');
    var acceptBtn = document.getElementById('disclaimerAccept');

    if (!overlay || !checkbox || !acceptBtn) return;

    // Check if already accepted
    if (localStorage.getItem(DISCLAIMER_KEY) === 'true') {
        overlay.classList.add('hidden');
        setTimeout(function () { overlay.remove(); }, 300);
        return;
    }

    // Enable button when checkbox is checked
    checkbox.addEventListener('change', function () {
        acceptBtn.disabled = !this.checked;
    });

    // Accept and close
    acceptBtn.addEventListener('click', function () {
        if (checkbox.checked) {
            localStorage.setItem(DISCLAIMER_KEY, 'true');
            overlay.classList.add('hidden');
            setTimeout(function () { overlay.remove(); }, 300);
        }
    });
})();
