/*
*
* - Fetches the user's Instagram auth cookies so they can be injected into request headers in order to sign API requests.
* - Listens for web requests and injects the Instagram auth cookies into the headers before sending the request.
*
*/

var instagramCookies = {};
var DOMAIN_URL = "https://www.instagram.com";
getCookies(function(cookies) {
  instagramCookies = cookies;  
});

// get Instagram cookies for auth
function getCookies(callback) {
  var cookieToReturn = {};
  chrome.cookies.get({url: DOMAIN_URL, name: 'ds_user_id'}, function(cookie) {
    cookieToReturn.ds_user_id = cookie.value;
    chrome.cookies.get({url: DOMAIN_URL, name: 'sessionid'}, function(cookie) {
      cookieToReturn.sessionid = cookie.value;
      if(callback) {
        callback(cookieToReturn);
      }
    });
  });
}

// hook into web request and modify headers before sending the request
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(info) {
    var headers = info.requestHeaders;
    headers.push({name:"x-ig-capabilities",value:"3w=="});
    headers.forEach(function(header, i) {
      if (header.name.toLowerCase() == 'user-agent') { 
        header.value = 'Instagram 9.0.2 (iPhone7,2; iPhone OS 9_3_3; en_US; en-US; scale=2.00; 750x1334) AppleWebKit/420+';
      }
      if (header.name.toLowerCase() == 'cookie') { 
        // add auth cookies to authenticate API requests
        var cookies = header.value;
        cookies = "ds_user_id=" + instagramCookies.ds_user_id + "; sessionid=" + instagramCookies.sessionid + ";";
        + cookies;
        header.value = cookies;
      }
    });  
    return {requestHeaders: headers};
  },
  {
    urls: [
      "*://*.instagram.com/*"
    ],
    types: ["main_frame", "sub_frame", "xmlhttprequest"]
  },
  ["blocking", "requestHeaders"]
);