// dmca-deter.js
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.deter-cb');
    const proceedBtn = document.getElementById('proceed-btn');
    const finalContact = document.getElementById('final-contact');
    const proceedWarning = document.getElementById('proceed-warning');

    function checkAllChecked() {
        return Array.from(checkboxes).every(cb => cb.checked);
    }

    function updateButtonState() {
        if (checkAllChecked()) {
            proceedBtn.disabled = false;
            proceedBtn.textContent = '✅ CONTINUE';
            proceedWarning.style.display = 'none';
        } else {
            proceedBtn.disabled = true;
            proceedBtn.textContent = '✅ I HAVE READ EVERYTHING AND STILL WISH TO PROCEED';
            proceedWarning.style.display = 'block';
        }
    }

    // Listen to every checkbox
    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateButtonState);
    });

    // Proceed button click
    proceedBtn.addEventListener('click', () => {
        if (checkAllChecked()) {
            finalContact.classList.remove('hidden');
            proceedBtn.style.display = 'none';
            // Scroll smoothly to the final section
            finalContact.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Copy email helper
    window.copyEmail = function() {
        const email = 'makron.company@protonmail.com';
        navigator.clipboard.writeText(email).then(() => {
            const original = event.target.textContent;
            event.target.textContent = '✅ Copied!';
            setTimeout(() => {
                event.target.textContent = original;
            }, 2000);
        });
    };

    console.log('%c🚨 DMCA form loaded', 'color:#0052cc; font-weight:600');
});