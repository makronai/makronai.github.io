// --- UI Navigation ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

function toggleCustomBase(selectId) {
    const select = document.getElementById(selectId);
    const customInput = document.getElementById(`${selectId}-custom`);
    if (select.value === 'custom') {
        customInput.classList.remove('hidden');
    } else {
        customInput.classList.add('hidden');
    }
}

// --- Conversion Logic ---
function parseToDecimal(value, format, customBase) {
    if (!value) return null;
    try {
        if (format === 'ascii') {
            return value.split('').map(c => c.charCodeAt(0)).join(' ');
        }
        
        let base = 10;
        if (format === 'custom') base = parseInt(customBase);
        else if (!isNaN(format)) base = parseInt(format);
        
        // Basic integer parsing for standard bases
        if (base >= 2 && base <= 36) {
            const dec = parseInt(value, base);
            return isNaN(dec) ? null : dec;
        }
        
        // Advanced logic placeholders for specialized corporate formats
        if (format === 'bcd' || format === 'onescomp' || format === 'signed8') {
             // For a full production rollout of bitwise complements, you would integrate a BigInt library here.
             return "Format requires extended math library";
        }
        return null;
    } catch (e) {
        return null;
    }
}

function formatFromDecimal(decValue, format, customBase) {
    if (decValue === null) return "Invalid Input";
    if (typeof decValue === 'string') return decValue; // Handles text passthroughs like ASCII mapping

    try {
        if (format === 'ascii') {
            return String.fromCharCode(decValue);
        }

        let base = 10;
        if (format === 'custom') base = parseInt(customBase);
        else if (!isNaN(format)) base = parseInt(format);

        if (base >= 2 && base <= 36) {
            return decValue.toString(base).toUpperCase();
        }
        
        return "Format requires extended math library";
    } catch (e) {
        return "Error";
    }
}

function calculateConversion() {
    const input = document.getElementById('conv-input').value.trim();
    const fromFormat = document.getElementById('conv-from').value;
    const fromCustom = document.getElementById('conv-from-custom').value;
    const toFormat = document.getElementById('conv-to').value;
    const toCustom = document.getElementById('conv-to-custom').value;
    const outDiv = document.getElementById('conv-output');

    if (!input) {
        outDiv.innerText = "0";
        return;
    }

    const decimalValue = parseToDecimal(input, fromFormat, fromCustom);
    const finalResult = formatFromDecimal(decimalValue, toFormat, toCustom);
    
    outDiv.innerText = finalResult;
}

// --- Arithmetic Logic ---
function calculateArithmetic() {
    const val1Str = document.getElementById('calc-val1').value.trim();
    const val2Str = document.getElementById('calc-val2').value.trim();
    const base1 = parseInt(document.getElementById('calc-base1').value);
    const base2 = parseInt(document.getElementById('calc-base2').value);
    const op = document.getElementById('calc-operator').value;
    const baseOut = parseInt(document.getElementById('calc-base-out').value);
    const outDiv = document.getElementById('calc-output');

    if (!val1Str || !val2Str) {
        outDiv.innerText = "0";
        return;
    }

    // Convert both to standard base 10 numbers for JS math
    const num1 = parseInt(val1Str, base1);
    const num2 = parseInt(val2Str, base2);

    if (isNaN(num1) || isNaN(num2)) {
        outDiv.innerText = "Invalid Base Input";
        return;
    }

    let resultDec = 0;
    switch(op) {
        case '+': resultDec = num1 + num2; break;
        case '-': resultDec = num1 - num2; break;
        case '*': resultDec = num1 * num2; break;
        case '/': 
            if (num2 === 0) { outDiv.innerText = "Divide by Zero Error"; return; }
            resultDec = Math.floor(num1 / num2); // Integer division standard for base calc
            break;
    }

    // Format out to target base
    outDiv.innerText = resultDec.toString(baseOut).toUpperCase();
}