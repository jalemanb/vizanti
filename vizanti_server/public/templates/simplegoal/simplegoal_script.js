let viewModule = await import(`${base_url}/js/modules/view.js`);
let tfModule = await import(`${base_url}/js/modules/tf.js`);
let rosbridgeModule = await import(`${base_url}/js/modules/rosbridge.js`);
let persistentModule = await import(`${base_url}/js/modules/persistent.js`);
let StatusModule = await import(`${base_url}/js/modules/status.js`);
let pathsModule = await import(`${base_url}/assets/btn/paths`);

let view = viewModule.view;
let tf = tfModule.tf;
let rosbridge = rosbridgeModule.rosbridge;
let settings = persistentModule.settings;
let Status = StatusModule.Status;
let paths = pathsModule.default;

let models = {};
paths.map(file => {
	const name = file.split('.svg')[0].split("_")[1];
	models[name] = new Image();
	models[name].src = `${base_url}/assets/btn/${file}`;
});

let topic = getTopic("{uniqueID}");
let status = new Status(
	document.getElementById("{uniqueID}_icon"),
	document.getElementById("{uniqueID}_status")
);

let button_offset_x = "50%";
let button_offset_y = "85%";
let button_sprite = "none";

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const vwToVh = vw => (vw * window.innerWidth) / window.innerHeight;

const sizeSlider = document.getElementById('{uniqueID}_size');
const sizeValue = document.getElementById('{uniqueID}_size_value');
const spriteSelector = document.getElementById('{uniqueID}_sprite');
const previewImg = document.getElementById("{uniqueID}_previewimg");
const buttonContainer = document.getElementById("{uniqueID}_button");
const buttonImg = buttonContainer.getElementsByTagName("img")[0];
const buttonIcon = buttonContainer.getElementsByTagName("img")[1];
const buttonSpriteIcon = buttonContainer.getElementsByTagName("img")[2];
const buttonpreview = document.getElementById('{uniqueID}_buttonpreview');


sizeSlider.addEventListener('input', () =>  {
	sizeValue.textContent = sizeSlider.value;
	saveSettings();
});

spriteSelector.addEventListener("change", (event) => {
	button_sprite = spriteSelector.value;
	previewImg.src = models[button_sprite].src;
	buttonSpriteIcon.src = models[button_sprite].src;
	saveSettings();
});

if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;
	sizeSlider.value = loaded_data.size;
	sizeValue.textContent = loaded_data.size;
	button_offset_x = loaded_data.offset_x;
	button_offset_y = loaded_data.offset_y;
	button_sprite = loaded_data.button_sprite ?? "none";
	previewImg.src = models[button_sprite].src;
	buttonSpriteIcon.src = models[button_sprite].src;

}else{
	saveSettings();
}

if(topic == ""){
	topic = "/goal_pose";
	status.setWarn("No topic found, defaulting to /goal_pose");
	saveSettings();
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic,
		size: sizeSlider.value,
		offset_x: button_offset_x,
		offset_y: button_offset_y,
		button_sprite: button_sprite,
	}
	settings.save();
	displayButtonImageOffset(button_offset_x, button_offset_y);
	displaySpriteList();

}

function sendMessage(pos, delta){
	if(!pos || !delta){
		status.setError("Could not send message, pose invalid.");
		return;
	}

	let yaw = Math.atan2(delta.y, -delta.x);
	let quat = Quaternion.fromEuler(yaw, 0, 0, 'ZXY');

	let map_pos = view.screenToFixed(pos);

	const currentTime = new Date();
	const currentTimeSecs = Math.floor(currentTime.getTime() / 1000);
	const currentTimeNsecs = (currentTime.getTime() % 1000) * 1e6;

	const publisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: topic,
		messageType: 'geometry_msgs/msg/PoseStamped',
	});

	const poseMessage = new ROSLIB.Message({
		header: {
			stamp: {
				sec: currentTimeSecs,
				nanosec: currentTimeNsecs
			},
			frame_id: tf.fixed_frame
		},
		pose: {
			position: {
				x: map_pos.x,
				y: map_pos.y,
				z: 0.0
			},
			orientation: {
				x: quat.x,
				y: quat.y,
				z: quat.z,
				w: quat.w
			}
		}
	});	
	publisher.publish(poseMessage);
	status.setOK();
}

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });

const view_container = document.getElementById("view_container");




const icon = document.getElementById("{uniqueID}_icon");
const iconImg = icon.getElementsByTagName('img')[0];

let active = false;
let sprite = new Image();
let start_point = undefined;
let delta = undefined;
sprite.src = "assets/simplegoal.png";

function drawArrow() {
    const wid = canvas.width;
    const hei = canvas.height;

	ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, wid, hei);

	if(delta){
		let ratio = sprite.naturalHeight/sprite.naturalWidth;
		ctx.setTransform(1,0,0,1,start_point.x, start_point.y); //sx,0,0,sy,px,py
		ctx.rotate(Math.atan2(-delta.y, -delta.x));
		ctx.drawImage(sprite, -80, -80*ratio, 160, 160*ratio);
	}
}

function startDrag(event){
    if (buttonContainer.contains(event.target)) {
        // console.log("Click was inside button container, ignoring drag start.");
        return; // Do nothing!
    }
	console.log("Start Arrow Drag");

	const { clientX, clientY } = event.touches ? event.touches[0] : event;
	start_point = {
		x: clientX,
		y: clientY
	};
}

function drag(event){

	if (buttonContainer.contains(event.target)) {
        // console.log("Click was inside button container, ignoring drag start.");
        return; // Do nothing!
    }
	if (start_point === undefined) return;

	const { clientX, clientY } = event.touches ? event.touches[0] : event;
	delta = {
		x: start_point.x - clientX,
		y: start_point.y - clientY,
	};

	drawArrow();	
}

function endDrag(event){

    if (buttonContainer.contains(event.target)) {
        // console.log("Click was inside button container, ignoring drag start.");
        return; // Do nothing!
    }
	console.log("End Arrow Drag");

	sendMessage(start_point, delta);

	start_point = undefined;
	delta = undefined;
	drawArrow();
	setActive(false);
}

function resizeScreen(){
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
}

window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);

function addListeners(){
	view_container.addEventListener('mousedown', startDrag);
	view_container.addEventListener('mousemove', drag);
	view_container.addEventListener('mouseup', endDrag);

	view_container.addEventListener('touchstart', startDrag);
	view_container.addEventListener('touchmove', drag);
	view_container.addEventListener('touchend', endDrag);	
}

function removeListeners(){
	view_container.removeEventListener('mousedown', startDrag);
	view_container.removeEventListener('mousemove', drag);
	view_container.removeEventListener('mouseup', endDrag);

	view_container.removeEventListener('touchstart', startDrag);
	view_container.removeEventListener('touchmove', drag);
	view_container.removeEventListener('touchend', endDrag);	
}

function setActive(value){
	active = value;
	view.setInputMovementEnabled(!active);

	if(active){
		addListeners();
		// buttonContainer.style.backgroundColor = "rgba(255, 255, 255, 1.0)";
		buttonImg.style.filter = "brightness(0) invert(1)";
		view_container.style.cursor = "pointer";
	}else{
		removeListeners()
		// buttonContainer.style.backgroundColor = "rgba(124, 124, 124, 0.3)";
		buttonImg.style.filter = "";
		view_container.style.cursor = "";
	}
}

// Topics
const selectionbox = document.getElementById("{uniqueID}_topic");

async function loadTopics(){
	let result = await rosbridge.get_topics("geometry_msgs/msg/PoseStamped");

	let topiclist = "";
	result.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+"</option>"
	});
	selectionbox.innerHTML = topiclist

	if(result.includes(topic)){
		selectionbox.value = topic;
	}else{
		topiclist += "<option value='"+topic+"'>"+topic+"</option>"
		selectionbox.innerHTML = topiclist
		selectionbox.value = topic;
	}
}

selectionbox.addEventListener("change", (event) => {
	topic = selectionbox.value;
	saveSettings();
	status.setOK();
});

loadTopics();

function displaySpriteList() {
	let spritelist = "";
	for (const [key, value] of Object.entries(models)) {
		spritelist += "<option value='"+key+"'>"+key+"</option>"
	}
	spriteSelector.innerHTML = spritelist;
	spriteSelector.value = button_sprite;
}


function displayButtonImageOffset(x, y) {
	// if (!buttonImg.complete) return; // Wait until image is fully loaded

	const size = parseFloat(sizeSlider.value); // percent of screen width

	buttonContainer.style.width = `${size}vw`;
	buttonContainer.style.height = `${size}vw`;
	buttonImg.style.width = `${size}vw`;
	buttonImg.style.height = `${size}vw`;

	let offset_x = clamp(parseFloat(x), size/2, 100 - size/2);
	let offset_y = clamp(parseFloat(y), size/2, 100 - size/2);

	buttonContainer.style.position = "absolute";
	buttonContainer.style.left = `${offset_x}%`;
	buttonContainer.style.top = `${offset_y}%`;
	buttonContainer.style.transform = "translate(-50%, -50%)";

	buttonpreview.style.left = `calc(${offset_x}% - 50px)`;
	buttonpreview.style.top = `calc(${offset_y}% - 50px)`;
}

// Long press modal open stuff

buttonContainer.addEventListener("click", (event) =>{
		setActive(!active);
});

//preview for moving around

let preview_active = false;

function onStart(event) {
	preview_active = true;
	document.addEventListener('mousemove', onMove);
	document.addEventListener('mouseup', onEnd);
	document.addEventListener('touchmove', onMove);
	document.addEventListener('touchend', onEnd);
}

function onMove(event) {
	if (preview_active) {
		event.preventDefault();
		let currentX, currentY;

		if (event.type === "touchmove") {
			currentX = event.touches[0].clientX;
			currentY = event.touches[0].clientY;
		} else {
			currentX = event.clientX;
			currentY = event.clientY;
		}

		button_offset_x = (currentX/window.innerWidth * 100) +"%";
		button_offset_y = (currentY/window.innerHeight * 100) +"%";
		saveSettings();

	}
}

function onEnd() {
	preview_active = false;
	document.removeEventListener('mousemove', onMove);
	document.removeEventListener('mouseup', onEnd);
	document.removeEventListener('touchmove', onMove);
	document.removeEventListener('touchend', onEnd);
}
  
buttonpreview.addEventListener('mousedown', onStart);
buttonpreview.addEventListener('touchstart', onStart);

displaySpriteList();
displayButtonImageOffset(button_offset_x, button_offset_y);
resizeScreen();

console.log("Simple Goal Widget Loaded {uniqueID}")