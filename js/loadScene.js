require([
	'goo/entities/GooRunner',
	'goo/entities/EntityUtils',
	'goo/shapes/ShapeCreator',
	'goo/renderer/Material',
	'goo/renderer/shaders/ShaderLib',
	'goo/renderer/bounds/BoundingBox',
	'goo/addons/ammo/AmmoSystem',
	'goo/addons/ammo/AmmoComponent',
	'goo/scripts/OrbitCamControlScript',
	'goo/math/Vector3',
	'goo/statemachine/FSMSystem',
	'goo/addons/howler/systems/HowlerSystem',
	'goo/loaders/DynamicLoader',
	'js/VehicleHelper'
], function (
	GooRunner, EntityUtils, ShapeCreator, Material, ShaderLib, BoundingBox, AmmoSystem, AmmoComponent, OrbitCamControlScript, Vector3,
	FSMSystem,
	HowlerSystem,
	DynamicLoader, VehicleHelper
) {
	'use strict';

	function init() {

		// If you try to load a scene without a server, you're gonna have a bad time
		if (window.location.protocol==='file:') {
			alert('You need to run this webpage on a server. Check the code for links and details.');
			return;

			/*

			Loading scenes uses AJAX requests, which require that the webpage is accessed via http. Setting up
			a web server is not very complicated, and there are lots of free options. Here are some suggestions
			that will do the job and do it well, but there are lots of other options.

			- Windows

			There's Apache (http://httpd.apache.org/docs/current/platform/windows.html)
			There's nginx (http://nginx.org/en/docs/windows.html)
			And for the truly lightweight, there's mongoose (https://code.google.com/p/mongoose/)

			- Linux
			Most distributions have neat packages for Apache (http://httpd.apache.org/) and nginx
			(http://nginx.org/en/docs/windows.html) and about a gazillion other options that didn't
			fit in here.
			One option is calling 'python -m SimpleHTTPServer' inside the unpacked folder if you have python installed.


			- Mac OS X

			Most Mac users will have Apache web server bundled with the OS.
			Read this to get started: http://osxdaily.com/2012/09/02/start-apache-web-server-mac-os-x/

			*/
		}

		// Make sure user is running Chrome/Firefox and that a WebGL context works
		var isChrome, isFirefox, isIE, isOpera, isSafari, isCocoonJS;
		isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
			isFirefox = typeof InstallTrigger !== 'undefined';
			isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
			isChrome = !!window.chrome && !isOpera;
			isIE = false || document.documentMode;
			isCocoonJS = navigator.appName === "Ludei CocoonJS";
		if (!(isFirefox || isChrome || isSafari || isCocoonJS || isIE === 11)) {
			alert("Sorry, but your browser is not supported.\nGoo works best in Google Chrome or Mozilla Firefox.\nYou will be redirected to a download page.");
			window.location.href = 'https://www.google.com/chrome';
		} else if (!window.WebGLRenderingContext) {
			alert("Sorry, but we could not find a WebGL rendering context.\nYou will be redirected to a troubleshooting page.");
			window.location.href = 'http://get.webgl.org/troubleshooting';
		} else {

			// Preventing brower peculiarities to mess with our control
			document.body.addEventListener('touchstart', function(event) {
				event.preventDefault();
			}, false);
			// Loading screen callback
			var progressCallback = function (handled, total) {
				var loadedPercent = (100*handled/total).toFixed();
				var loadingOverlay = document.getElementById("loadingOverlay");
				var progressBar = document.getElementById("progressBar");
				var progress = document.getElementById("progress");
				var loadingMessage = document.getElementById("loadingMessage");
				loadingOverlay.style.display = "block";
				loadingMessage.style.display = "block";
				progressBar.style.display = "block";
				progress.style.width = loadedPercent + "%";
			};

			// Create typical Goo application
			var goo = new GooRunner({
				antialias: true,
				manuallyStartGameLoop: true
			});
			var fsm = new FSMSystem(goo);
			goo.world.setSystem(fsm);
			goo.world.setSystem(new HowlerSystem());

			var ammoSystem = new AmmoSystem({stepFrequency:60});
			goo.world.setSystem(ammoSystem);

			var vehicleHelper;
			
			var keys = new Array(127).join('0').split('').map(parseFloat); // prefill with 0s
			var keyHandler = function (e) {
				keys[e.keyCode] = e.type === "keydown" ? 1 : 0;
				if( keys[82]) { // r
					vehicleHelper.resetAtPos(0, 4, 0);
				}
				if( keys[32]) {
					addPrimitives(goo);
				}
			}
			document.body.addEventListener('keyup', keyHandler, false);
			document.body.addEventListener('keydown', keyHandler, false);

			// The loader takes care of loading the data
			var loader = new DynamicLoader({ world: goo.world, rootPath: 'res', progressCallback: progressCallback});

			loader.loadFromBundle('project.project', 'root.bundle', {recursive: false, preloadBinaries: true}).then(function(configs) {

				// This code will be called when the project has finished loading.
				goo.renderer.domElement.id = 'goo';
				document.body.appendChild(goo.renderer.domElement);
				
				for( var k in configs)if(k[k.length-1] == 'y' ) {
				  console.log(k);
				}

				//var carBody = loader.getCachedObjectForRef('car/entities/car_body_mesh_0.entity');
				var car = loader.getCachedObjectForRef('car/entities/RootNode.entity');
				var logo = loader.getCachedObjectForRef('goo_logo/entities/goo_logo_mesh_0.entity');

				car.transformComponent.addTranslation( -4, 5, 5);
				goo.world.process();

				logo.setComponent(new AmmoComponent({mass:0, useWorldTransform:true}));
				car.setComponent(new AmmoComponent({mass:350, useWorldBounds:true, showBounds:false}));

				vehicleHelper = new VehicleHelper(goo, ammoSystem, car, 3, 0.6, false);
				vehicleHelper.setWheelAxle( 1, 0, 0);
				//vehicleHelper.doCreateDebugTire = true;
				vehicleHelper.addDefaultWheels();
				var vehicle = vehicleHelper.vehicle;
				
				var cam = loader.getCachedObjectForRef('entities/DefaultToolCamera.entity');

				cam.scriptComponent.scripts = [];

			    var camOffset = new Vector3(0,15,-15);
                var camPos = new Vector3();

                goo.callbacks.push(function(tpf) {
					vehicleHelper.setSteeringValue( keys[37] * 0.3 + keys[39] * -0.3);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500);
					vehicleHelper.updateWheelTransform();

                    camPos.set(car.transformComponent.transform.translation);
                    camPos.add(camOffset)
                    cam.transformComponent.transform.translation.lerp(camPos, tpf);
                    cam.transformComponent.transform.lookAt(car.transformComponent.transform.translation,Vector3.UNIT_Y);
                    cam.transformComponent.setUpdated();


                });


				// Application code goes here!

				// Start the rendering loop!
				goo.startGameLoop();

			}).then(null, function(e) {
				// If something goes wrong, 'e' is the error message from the engine.
				console.log('Failed to load scene: ' + e.stack);
			});

		}
	}

	init();
});
