var serverAddress = location.protocol + "//" + location.host;

document.querySelector("button#start").addEventListener("click", initCmd);
document.querySelector("button#startp").addEventListener("click", initCmd);
document.querySelector("button#scripts").addEventListener("click", setCmd);
document.querySelector("button#images").addEventListener("click", setCmd);
document.querySelector("button#run").addEventListener("click", runCmd);
document.querySelector("button#stop").addEventListener("click", stopCmd);

function initCmd(e) {
  var command = e.target.id;
  var url = encodeURI(serverAddress + "/" + command);
  outputToMonitor(true, command + ": GET " + url);
  ajax("GET", url);
}

function setCmd(e) {
  var folderPath = document.querySelector("input#folder-path").value;
  if (folderPath === null || folderPath.trim() == "") {
    alert("Input the folder path.");
    return false;
  }

  var command = e.target.id;
  var url = encodeURI(serverAddress + "/" + command + "/" + folderPath.replace(/\\|:\\/gi, "/"));
  outputToMonitor(true, command + ": GET " + url);
  ajax("GET", url);
}

function runCmd(e) {
  var scriptName = document.querySelector("input#script-name").value;
  if (scriptName === null || scriptName.trim() == "") {
    alert("Input the script name.");
    return false;
  }
  var scriptArgs = "";
  try {
    scriptArgs = parseArgs(document.querySelector("textarea#script-args").value);
  } catch(ex) {
    alert("The script arguments input is incorrect : " + ex);
    return false;
  }

  var command = e.target.id;
  var url = encodeURI(serverAddress + "/" + command + "/" + scriptName);
  if (scriptArgs.length > 0) {
    var queryValue = "";
    scriptArgs.forEach(function(arg) {
      queryValue += encodeURIComponent(arg) + ";";
    });
    url += "?args=" + queryValue;
  }
  outputToMonitor(true, command + ": GET " + url);
  ajax("GET", url);
}

function stopCmd(e) {
  var command = e.target.id;
  var url = encodeURI(serverAddress + "/" + command);
  outputToMonitor(true, command + ": GET " + url);
  ajax("GET", url);
}

function ajax(method, url, body) {
  switchButtonsDisabled(true);

  var xhr = new XMLHttpRequest();
  xhr.addEventListener("load", xhrEventListener);
  xhr.addEventListener("timeout", xhrEventListener);
  xhr.addEventListener("error", xhrEventListener);
  xhr.addEventListener("abort", xhrEventListener);
  xhr.open(method, url);
  xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
  xhr.send(body);
}

function xhrEventListener(e) {
  if (e.type == "load") {
    var message = String(this.responseText);
    if (message.indexOf("PASS") == 0) {
      message = '<span class="font-pass">PASS</span>' + message.substring(4);
    } else if (message.indexOf("FAIL") == 0) {
      message = '<span class="font-fail">FAIL</span>' + message.substring(4);
    }
    outputToMonitor(false, message);
  } else if(e.type == "timeout") {
    outputToMonitor(false, '<span class="font-fail">Request timed out</span>');
  } else {
    outputToMonitor(false, '<span class="font-fail">Can\'t be reached the server</span>');
  }

  switchButtonsDisabled(false);
}

function switchButtonsDisabled(toDisable) {
  var buttons = document.querySelectorAll("button");
  for (var i=0, len=buttons.length; i<len; i++) {
    if (!buttons[i].hasAttribute("disabled")) {
      if (toDisable)
        buttons[i].setAttribute("disabled", "disabled");
    } else {
      if (!toDisable)
        buttons[i].removeAttribute("disabled");
    }
  }
}

function outputToMonitor(isRequest, message) {
  var monitor = document.querySelector("#monitor pre");

  var beforeScrollTop = monitor.scrollTop;
  var beforeScrollTopMax = monitor.scrollHeight-monitor.clientHeight;

  var padding = monitor.querySelector("p#padding");
  if (padding !== null) {
    monitor.removeChild(padding);
  }
  var element = document.createElement(isRequest?"kbd":"samp");
  element.innerHTML = message + "<br>";
  monitor.appendChild(element);
  padding = document.createElement("p");
  padding.id = "padding";
  padding.innerHTML = "<br>";
  monitor.appendChild(padding);

  // scrolling
  if (((monitor.scrollHeight-monitor.clientHeight) > 0) && (beforeScrollTop == beforeScrollTopMax)) {
    monitor.scrollTop = monitor.scrollHeight-monitor.clientHeight;
  }
}

function parseArgs(input) {
  const STATE_NONE              = 0;
  const STATE_CHAR_FOUND        = 1;
  const STATE_QUOTED_APOSTROPHE = 2;
  const STATE_QUOTED_QUOTATION  = 4;

  const inputTrimed = input.replace(/\r?\n/g, ' ').trim();

  let args = [];
  let buf = [];
  let state = STATE_NONE;
  for (let i=0; i<inputTrimed.length; i++) {
    const code = inputTrimed.charCodeAt(i);
    switch(code) {
      case 32: // SPACE
        if (state == STATE_NONE) {
          continue;
        }
        if (state == STATE_CHAR_FOUND) {
          args.push(String.fromCharCode.apply(this, buf));
          buf.splice(0);
          state = STATE_NONE;
          continue;
        }
        if (state & (STATE_QUOTED_APOSTROPHE | STATE_QUOTED_QUOTATION)) {
          buf.push(code);
          state |= STATE_CHAR_FOUND;
          continue;
        }
      case 34: // QUOTATION MARK
        if (state == STATE_NONE) {
          state |= STATE_QUOTED_QUOTATION;
          continue;
        }
        if (state == STATE_CHAR_FOUND) {
          throw "invalid quote symbol";
        }
        if (state & STATE_QUOTED_APOSTROPHE) {
          buf.push(code);
          state |= STATE_CHAR_FOUND;
          continue;
        }
        if (state & STATE_QUOTED_QUOTATION) {
          state ^= STATE_QUOTED_QUOTATION;
          continue;
        }
      case 39: // APOSTROPHE
        if (state == STATE_NONE) {
          state |= STATE_QUOTED_APOSTROPHE;
          continue;
        }
        if (state == STATE_CHAR_FOUND) {
          throw "invalid quote symbol";
        }
        if (state & STATE_QUOTED_APOSTROPHE) {
          state ^= STATE_QUOTED_APOSTROPHE;
          continue;
        }
        if (state & STATE_QUOTED_QUOTATION) {
          buf.push(code);
          state |= STATE_CHAR_FOUND;
          continue;
        }
      default:
        buf.push(code);
        state |= STATE_CHAR_FOUND;
        continue;
    }
  }
  if (state == STATE_NONE) {
    // NOOP
  }
  if (state == STATE_CHAR_FOUND) {
    args.push(String.fromCharCode.apply(this, buf));
    buf.splice(0);
    state = STATE_NONE;
  }
  if (state & (STATE_QUOTED_APOSTROPHE | STATE_QUOTED_QUOTATION)) {
    throw "missing quote end symbol";
  }

  return args;
}
