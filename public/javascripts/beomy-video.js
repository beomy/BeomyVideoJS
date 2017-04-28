function VideoBasic (src) {
    this._src = src;
    this._video = document.querySelector(src);
}
VideoBasic.prototype.playVideo = function (dst) {
    var dstNode = document.querySelector(dst);
    var status = dstNode.getAttribute("data-play");
    if (status != "play") {
        dstNode.setAttribute("data-play", "play");
        trigger(dst, "_play");
    }
}
VideoBasic.prototype.pauseVideo = function (dst) {
    var dstNode = document.querySelector(dst);
    var status = dstNode.getAttribute("data-play");
    if (status != "pause") {
        dstNode.setAttribute("data-play", "pause");
        trigger(dst, "_pause");
    }
}
VideoBasic.prototype.stopVideo = function (dst) {
    var dstNode = document.querySelector(dst);
    var status = dstNode.getAttribute("data-play");
    if (status != "stop") {
        dstNode.setAttribute("data-play", "stop");
        trigger(dst, "_stop");
    }
}
VideoBasic.prototype.convertVideo = function (dst, convertFunc) {
    var v = this._video;
    var canvas = document.querySelector(dst);

    if (canvas.tagName.toUpperCase() != "CANVAS") {
        var temp = document.createElement("canvas");

        // Copy the children
        while (canvas.firstChild) {
            temp.appendChild(canvas.firstChild); // *Moves* the child
        }

        // Copy the attributes
        for (var i = 0; i < canvas.attributes.length; i++) {
            temp.attributes.setNamedItem(canvas.attributes[i].cloneNode());
        }

        // Replace it
        canvas.parentNode.replaceChild(temp, canvas);
        canvas = document.querySelector(dst);
    }

    var context = canvas.getContext('2d');
    var back = document.createElement('canvas');
    var backcontext = back.getContext('2d');

    var cw,ch;

    canvas.addEventListener('_play', function(){
        cw = v.clientWidth;
        ch = v.clientHeight;
        canvas.width = cw;
        canvas.height = ch;
        back.width = cw;
        back.height = ch;
        draw(v,context,backcontext,cw,ch,dst);
    }, false);

    function draw(v,c,bc,w,h,dst) {
        var status = document.querySelector(dst).getAttribute("data-play");
        if(v.paused || v.ended || status != "play") return false;
        // First, draw it into the backing canvas
        bc.drawImage(v,0,0,w,h);
        // Grab the pixel data from the backing canvas
        var srcImageData = bc.getImageData(0,0,w,h);
        var dstImageData = bc.getImageData(0,0,w,h);
        // Convert image
        convertFunc(srcImageData.data, dstImageData.data, w, h);
        // Draw the pixels onto the visible canvas
        c.putImageData(dstImageData,0,0);
        // Start over!
        setTimeout(draw.bind(this),20,v,c,bc,w,h,dst);
    };
}



function WebCamController (src) {
    VideoBasic.call(this, src);
    var webCamStream;

    this._video.addEventListener("_play", function () {
        var video = this;
        video.setAttribute("autoplay", "true");

        if (video.src == "") {
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;

            if (navigator.getUserMedia) {
                navigator.getUserMedia({video: true}, handleVideo, videoError);
            }

            function handleVideo(stream) {
                video.src = window.URL.createObjectURL(stream);
                webCamStream = stream;
            }

            function videoError(e) {
                // do something
            }
        } else {
            video.play();
        }
    });

    this._video.addEventListener("_pause", function () {
        var video = this;
        video.pause();
    });

    this._video.addEventListener("_stop", function () {
        var video = this;
        video.pause();
        video.src = "";
        video.removeAttribute("src");
        video.removeAttribute("autoplay");
        webCamStream.getTracks()[0].stop();
    });
}
WebCamController.prototype = new VideoBasic();
WebCamController.prototype.constructor = WebCamController;
WebCamController.prototype.playVideo = function () {
    VideoBasic.prototype.playVideo(this._src);
}
WebCamController.prototype.pauseVideo = function () {
    VideoBasic.prototype.pauseVideo(this._src);
}
WebCamController.prototype.stopVideo = function () {
    VideoBasic.prototype.stopVideo(this._src);
}



function VideoConverter (src) {
    VideoBasic.call(this, src);
}
VideoConverter.prototype = new VideoBasic();
VideoConverter.prototype.constructor = VideoConverter;
VideoConverter.prototype.convertGrayVideo = function (dst) {
    var convertFunc = function (srcData, dstData) {
        // Loop through the pixels, turning them grayscale
        for(var i = 0; i < srcData.length; i+=4) {
            var r = srcData[i];
            var g = srcData[i+1];
            var b = srcData[i+2];
            var brightness = (3*r+4*g+b)>>>3;
            dstData[i] = brightness;
            dstData[i+1] = brightness;
            dstData[i+2] = brightness;
        }
    }
    this.convertVideo(dst, convertFunc);
}
VideoConverter.prototype.robertEdgeDetection = function (dst) {
    var convertFunc = function (srcData, dstData, w, h) {
        for (var i = 0; i < srcData.length; i++) {
            if( i%4 == 3 ) continue;
            var bl = i - w*4;
            dstData[i] = 127 + srcData[i]*2 - srcData[bl + 4] - srcData[bl - 4];
        }
    }
    this.convertVideo(dst, convertFunc);
}
VideoConverter.prototype.sobelEdgeDetection = function (dst) {
    var convertFunc = function (srcData, dstData, w, h) {
        for (var i = 0; i < srcData.length; i++) {
            if( i%4 == 3 ) continue;
            var _0 = i - w*4 - 4;
            var _1 = _0 + 4;
            var _2 = _1 + 4;
            var _3 = i - 4;
            var _4 = _3 + 4;
            var _5 = _4 + 4;
            var _6 = i + w*4 - 4;
            var _7 = _6 + 4;
            var _8 = _7 + 4;

            var temp = 0;
            temp += (srcData[_2] - srcData[_0]) + (srcData[_5] - srcData[_3])*2 + (srcData[_8] - srcData[_6]);
            temp += (srcData[_0] - srcData[_6]) + (srcData[_1] - srcData[_7])*2 + (srcData[_2] - srcData[_8]);
            dstData[i] = temp;
        }
    }
    this.convertVideo(dst, convertFunc);
}
VideoConverter.prototype.edgeDetection = function (dst, filter) {
    if (filter === undefined) filter = "BASIC";

    switch (filter.toUpperCase()) {
        case "ROBERT" :
            // Robert Ddge Detection - RGB Domain
            this.robertEdgeDetection(dst);
            break;
        case "SOBEL" :
            // Sobel Edge Detection - RGB Domain
            this.sobelEdgeDetection(dst);
            break;
        case "BASIC" :
        default :
            var convertFunc = function (srcData, dstData, w, h) {
                // Basic Ddge Dection - RGB Domain
                for(var i = 0; i < srcData.length; i++) {
                    if( i%4 == 3 ) continue;
                    dstData[i] = 127 + 2*srcData[i] - srcData[i + 4] - srcData[i + w*4];
                }
            }
            this.convertVideo(dst, convertFunc);
            break;
    }
}



function VideoManager (src) {
    this._src = src;
    this._webCamController = new WebCamController(src);
    this._videoConverter = new VideoConverter(src);
}
VideoManager.prototype.playWebCam = function () {
    this._webCamController.playVideo();
}
VideoManager.prototype.pauseWebCam = function () {
    this._webCamController.pauseVideo();
}
VideoManager.prototype.stopWebCam = function () {
    this._webCamController.stopVideo();
}
VideoManager.prototype.convertGrayVideo = function (dst) {
    this._videoConverter.convertGrayVideo(dst);
}
VideoManager.prototype.edgeDetection = function (dst, filter) {
    this._videoConverter.edgeDetection(dst, filter);
}
VideoManager.prototype.convertStart = function (dst) {
    this._videoConverter.playVideo(dst);
}
VideoManager.prototype.convertStop = function (dst) {
    this._videoConverter.stopVideo(dst);
}




var trigger = function(element, event) {
    element = document.querySelector(element);
    var evt;
    if (document.createEventObject) {
        // dispatch for IE
        evt = document.createEventObject();
        return element.fireEvent('on' + event, evt)
    }
    else {
        // dispatch for firefox + others
        evt = document.createEvent("HTMLEvents");
        evt.initEvent(event, true, true); // event type,bubbling,cancelable
        return !element.dispatchEvent(evt);
    }
}
