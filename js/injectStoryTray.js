var API_BASE = "https://i.instagram.com/api/v1/feed/";
var INSTAGRAM_FEED_CLASS_NAME = "_qj7yb";

// BEGIN INJECTION
injectPswpContainer();
loadStories();

// listen for background.js to send over cookies so we are clear to make requests
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    var instagramCookies = JSON.parse(request);    
    // only fetch stories if the cookies are available
    if((instagramCookies.ds_user_id && instagramCookies.sessionid)) {
      getStories();
    } 
  });

// tell background.js to load cookies so we can check if they are available before we make requests
function loadStories() {
  chrome.runtime.sendMessage('loadStories');
}

// ping Instagram API for new Stories in tray
function getStories() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", API_BASE + "reels_tray/", true);
  xhr.withCredentials = true;
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if(xhr.status == 200) {
        injectStoryTray(JSON.parse(xhr.responseText));
      }
    }
  }
  xhr.send();
}

// ping Instagram API for a specific user's Story
function getStory(userId) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", API_BASE + "user/" + userId + "/reel_media/", true);
    xhr.withCredentials = true;
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if(xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(xhr.statusText);
        }
      } 
    }
    xhr.send();
  });
}

// inject div container to host the Story image gallery
function injectPswpContainer() {
  var pswpContainer = document.createElement("div");
  pswpContainer.setAttribute("id", "pswpContainer");
  document.body.appendChild(pswpContainer);
}

// inject Instagram Stories tray above the main Instagram feed
function injectStoryTray(response) {
  var trayContainer = document.createElement("div");
  trayContainer.setAttribute("id", "trayContainer");
  
  var tray = response["tray"];
  
  // iterate through every friend
  for(var i = 0; i < tray.length; i++) {
    
    var trayItem = tray[i];
    
    (function(trayItem) {
      
      var user = trayItem['user'];
      var picture = user['profile_pic_url'];
      
      var trayItemImage = document.createElement('img');
      trayItemImage.setAttribute("id", "trayItemImage" + i);
      trayItemImage.width = 64;
      trayItemImage.height = 64;
      trayItemImage.setAttribute("class", ((trayItem.items) ? "unseenStoryItem" : "seenStoryItem") + " trayItemImage");
      trayItemImage.src = picture.replace("http://", "https://");
      trayItemImage.title = user.username;
      
      trayItemImage.addEventListener("click", function() {
        if(trayItem.items) {
          // if there are new Story images available, show them in the gallery
          showImageGallery(trayItem.items);
        } else {
          // retrieve the user's Story and show them in the gallery
          return getStory(trayItem.id).then(function(story) {
            showImageGallery(story.items);
          }, function(error) {
            alert("There was an error trying to load this person's Story.");
            console.log("Error loading Story for user: " + JSON.stringify(error));
          });
        }
      });
      
      // right click context menu for downloading Story
      (function(i) {
        $(function() {
          $.contextMenu({
            selector: '#trayItemImage' + i, 
            callback: function(key, options) {
              if(trayItem.items) {
                // if there are new Story images available, download them
                downloadStory(trayItem);
              } else {
                // retrieve the user's Story and download it
                return getStory(trayItem.id).then(function(story) {
                  downloadStory(story);
                }, function(error) {
                  alert("There was an error trying to download this person's Story.");
                  console.log("Error downloading Story for user: " + JSON.stringify(error));
                });
              }    
            },
            items: {
              "download": {name: "Download Story"}
            }
          });
          
        });
      })(i);
      
      trayContainer.appendChild(trayItemImage);
      
    })(trayItem);
    
  }
  
  // inject Story tray above Instagram feed
  var instagramFeed = document.getElementsByClassName(INSTAGRAM_FEED_CLASS_NAME)[0];
  if(instagramFeed) {
    instagramFeed.insertBefore(trayContainer, instagramFeed.childNodes[0]);
  }
}

// downloads a zip file containing the user's Story
function downloadStory(trayItem) {
  var zip = new JSZip();
  trayItem.items.map((storyItem, i) => {
    var mediaItemUrl = getMediaItemUrl(storyItem);
    // downloads each Story image/video and adds it to the zip file
    zip.file(getStoryFileName(storyItem, mediaItemUrl), urlToPromise(mediaItemUrl), {binary:true});
  });
  // generate zip file and start download
  zip.generateAsync({type:"blob"})
  .then(function(content) {
    saveAs(content, getZipFileName(trayItem));
  });
}

// promises to download the file before zipping it
function urlToPromise(url) {
  return new Promise(function(resolve, reject) {
    JSZipUtils.getBinaryContent(url, function (err, data) {
      if(err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

// returns the name of the zip file to download with format: (username-timestamp.zip)
function getZipFileName(trayItem) {
  return trayItem.user.username + "-" + moment().format() + ".zip";
}

// returns the name of the image/video file to add to the zip file
function getStoryFileName(storyItem, mediaItemUrl) {
  return storyItem['id'] + (((mediaItemUrl.includes(".mp4")) ? ".mp4" : ".jpg"));
}

// returns an optimized URL format for the image/video
function getMediaItemUrl(storyItem) {
  var mediaItem;
  if(storyItem['video_versions']) {
    mediaItem = storyItem['video_versions'][0];
  } else {
    mediaItem = storyItem['image_versions2']['candidates'][0];
  }
  var secureUrl = mediaItem['url'].replace("http://", "https://");
  return secureUrl.split("?")[0]; // leave out ig_cache_key
}

// used to initialize and show the Story image gallery
function getPswpElement(callback) {
  // if photoswipe element exists, return it
  if($('#pswp').length) {
    callback(document.getElementById('pswp'));
  } else {
    // photoswipe element doesn't exist, inject it
    $("#pswpContainer").load(chrome.extension.getURL("html/photoswipe.html"), function() {
      callback(document.getElementById('pswp'));
    });
  }
}

// displays image gallery for Story images
function showImageGallery(storyItems) {
  
  // retrieve the injected pswpElement
  getPswpElement(function(pswpElement) {
    var slides = [];
    
    storyItems.map((storyItem, i) => {
      // if videos are available, create a new HTML slide containing the Story video
      if(storyItem['video_versions']) {
        var video = storyItem['video_versions'][0];
        slides.push({
          html: '<video class="pswp__video' + ' active' + '" controls' + ((i == 0) ? ' autoplay' : '') + '><source src="' + video['url'] + '" type="video/mp4"></video>'
        });
      } else {
        // create a normal slide with the Story image
        var image = storyItem['image_versions2']['candidates'][0];
        var url = image['url'].replace("http://", "https://");
        slides.push({
          src: url,
          msrc: url,
          w: image['width'],
          h: image['height'],
          title: storyItem['user']['username'] + " - " + moment.unix(storyItem['taken_at']).fromNow()
        });
      }
    });
    
    var options = {
      closeOnScroll: false,
      shareEl: false
    };
    
    var gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, slides, options);
    gallery.init();
    
    // handle playing/pausing videos while traversing the gallery
    gallery.listen('beforeChange', function() {
      var currItem = $(gallery.currItem.container);
      // remove 'active' class from any videos
      $('.pswp__video').removeClass('active');
      // add 'active' class to the currently playing video
      var currItemIframe = currItem.find('.pswp__video').addClass('active');
      // for each video, pause any inactive videos, and play the active video
      $('.pswp__video').each(function() {
        if (!$(this).hasClass('active')) {
          $(this)[0].pause();
          $(this)[0].currentTime = 0;
        } else {
          $(this)[0].play();
        }
      });
    });
    
    // handle pausing videos when the galley is closed
    gallery.listen('close', function() {
      $('.pswp__video').each(function() {
        $(this)[0].pause();
      });
    });
    
  });
  
}