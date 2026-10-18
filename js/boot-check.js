/* Runs first, in ES5 on purpose: tells users of browsers that are too old (Chrome < 73,
   Internet Explorer) what to do, instead of showing a blank page. */
(function () {
  var ok = typeof Object.fromEntries == "function" && typeof String.prototype.padStart == "function" && typeof TextEncoder == "function";
  window.OPF_BROWSER_OK = ok;
  if (!ok) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.innerHTML = '<div style="font:16px Arial;padding:40px;max-width:640px">' +
        "<h2>This browser is too old for One Plus Fashion ERP</h2>" +
        "<p>Please open the ERP with Google Chrome (version 73 or newer; version 109 is the last one for Windows 7) or Firefox. " +
        "Double-click <b>START_ERP.bat</b> after installing Chrome.</p></div>";
    });
  }
})();
