/*
*
* - Fetches the user's Instagram auth cookies so they can be injected into request headers in order to sign API requests.
* - Listens for web requests and injects the Instagram auth cookies into the headers before sending the request.
*
*/

var instagramCookies = {};
var DOMAIN_URL = "https://www.instagram.com";

loadCookies();

function loadCookies() {
  getCookies(function(cookies) {
    instagramCookies = cookies;  
  });
}

// get Instagram cookies for auth
function getCookies(callback) {
  var cookieToReturn = {};
  chrome.cookies.get({url: DOMAIN_URL, name: 'ds_user_id'}, function(cookie) {
    if(cookie) { cookieToReturn.ds_user_id = cookie.value; }
    chrome.cookies.get({url: DOMAIN_URL, name: 'sessionid'}, function(cookie) {
      if(cookie) { cookieToReturn.sessionid = cookie.value; }
      if(callback) {
        callback(cookieToReturn);
      }
    });
  });
}

// hook into web request and modify headers before sending the request
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(info) {
    loadCookies();
    
    var headers = info.requestHeaders;
    var shouldInjectHeaders = true;
    
    // if auth cookies are missing, doesn't inject them
    if(!(instagramCookies.ds_user_id && instagramCookies.sessionid)) {
      shouldInjectHeaders = false;
    }
    
    // if the referer isn't the main page, don't tamper with the headers and inject the auth cookies
    if(shouldInjectHeaders) {
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if(header.name.toLowerCase() == 'referer') {
          if(header.value != "https://www.instagram.com/") {
            shouldInjectHeaders = false;
          }
        }
      }
    }
    
    // only inject auth cookies for requests relating to the Instagram Story tray,
    // tampering with the headers on any other request will give you errors
    if(shouldInjectHeaders) {
      headers.push({name:"x-ig-capabilities",value:"3w=="});
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if(header.name.toLowerCase() == 'referer') {
          if(header.value != "https://www.instagram.com/") {
            shouldInjectHeaders = false;
          }
        }
        if (header.name.toLowerCase() == 'user-agent' && shouldInjectHeaders) { 
          header.value = 'Instagram 9.0.2 (iPhone7,2; iPhone OS 9_3_3; en_US; en-US; scale=2.00; 750x1334) AppleWebKit/420+';
        }
        if (header.name.toLowerCase() == 'cookie' && shouldInjectHeaders) { 
          // add auth cookies to authenticate API requests
          var cookies = header.value;
          cookies = "ds_user_id=" + instagramCookies.ds_user_id + "; sessionid=" + instagramCookies.sessionid + ";";
          + cookies;
          header.value = cookies;
        }
      }
    }
    
    return {requestHeaders: headers};
  },
  {
    urls: [
      "*://*.instagram.com/*"
    ],
    types: ["xmlhttprequest"]
  },
  ["blocking", "requestHeaders"]
);