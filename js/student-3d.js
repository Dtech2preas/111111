
if (!window.safeParse) {
    window.safeParse = (data) => {
        let parsed = data;
        while (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            } catch(e) {
                console.error("Failed to parse data:", e);
                return null;
            }
        }
        return parsed;
    };
}

if (!window.fetchFloorData) {
    window.fetchFloorData = async (level) => {
        const residenceId = localStorage.getItem('dtech_residence_id');
        if (window.FirebaseStorageManager && residenceId) {
            try {
                const fbData = await window.FirebaseStorageManager.loadFromFirebase(residenceId, level);
                if (fbData) {
                    console.log(`Fetched floor ${level} from Firebase`);
                    return window.safeParse(fbData);
                }
            } catch (e) {
                console.error("Firebase fetch error:", e);
            }
        }
        // Fallback to local storage ONLY if firebase fails or is unavailable
        const localData = localStorage.getItem('dtech_floorplan_v2_floor_' + level);
        if (localData) {
             console.log(`Fetched floor ${level} from localStorage`);
             return window.safeParse(localData);
        }
        return null;
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // Basic Three.js setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    // Adding some fog to make it look nicer
    scene.fog = new THREE.Fog(0xf0f0f0, 2000, 5000);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 1000, 1000);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Controls
    const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    const pointerLockControls = new THREE.PointerLockControls(camera, document.body);

    let isWalkMode = false;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 2000, 0);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 1000, 500);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.top = 2000;
    directionalLight.shadow.camera.bottom = -2000;
    directionalLight.shadow.camera.left = -2000;
    directionalLight.shadow.camera.right = 2000;
    directionalLight.shadow.bias = -0.001;
    scene.add(directionalLight);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(5000, 50, 0x888888, 0xdddddd);
    scene.add(gridHelper);

    // State
    let targetFloorLevel = 0;
    const floorGroups = {};
    let isDisplayingAllFloors = false;
    const floorHeight = 300; // units
    const wallsGroup = new THREE.Group();
    scene.add(wallsGroup);

    let wallsMaterials = [];
    let isTransparent = false;


    // Animation state variables for camera tweening and floor fading
    let cameraTargetPos = null;
    let controlsTargetPos = null;
    let cameraTweenSpeed = 0.05;
    let isAutoWalking = false;
    let walkPoints = [];
    let walkProgress = 0;
    const walkSpeed = 0.001; // Curve progress per frame
    let walkCurve = null;

    function lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }

    // Movement state
    const moveState = { forward: false, backward: false, left: false, right: false };
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    let prevTime = performance.now();

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard handlers
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveState.forward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveState.left = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveState.backward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveState.right = true;
                break;
        }
    };

    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveState.forward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveState.left = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveState.backward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveState.right = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);

        const time = performance.now();


        // Camera Tweening
        if (cameraTargetPos && !isWalkMode && !isAutoWalking) {
            camera.position.lerp(cameraTargetPos, cameraTweenSpeed);
            if (controlsTargetPos) {
                orbitControls.target.lerp(controlsTargetPos, cameraTweenSpeed);
            }
            if (camera.position.distanceTo(cameraTargetPos) < 1) {
                cameraTargetPos = null;
                controlsTargetPos = null;
            }
        }

        // Auto Walkthrough
        if (isAutoWalking && walkCurve) {
            walkProgress += walkSpeed;
            if (walkProgress > 1) walkProgress = 0; // loop

            const pt = walkCurve.getPointAt(walkProgress);
            const ptLook = walkCurve.getPointAt((walkProgress + 0.01) % 1);

            camera.position.set(pt.x, pt.y, pt.z);
            camera.lookAt(ptLook);
        }

        // Floor Fading (smooth transitions)
        Object.keys(floorGroups).forEach(level => {
            const group = floorGroups[level];
            const targetVisible = isDisplayingAllFloors || parseInt(level) === targetFloorLevel;

            // Adjust materials opacity smoothly
            let currentOpacity = group.userData.currentOpacity !== undefined ? group.userData.currentOpacity : (group.visible ? 1 : 0);
            const targetOpacity = targetVisible ? 1 : 0;
            const fadeSpeed = 0.05; // Make fade slower by adjusting this

            if (currentOpacity !== targetOpacity) {
                group.visible = true;
                currentOpacity = lerp(currentOpacity, targetOpacity, fadeSpeed);
                if (Math.abs(currentOpacity - targetOpacity) < 0.01) {
                    currentOpacity = targetOpacity;
                    if (currentOpacity === 0) group.visible = false;
                }

                group.userData.currentOpacity = currentOpacity;

                // apply to meshes
                group.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.transparent = true;

                        // Handle toggle transparency mode
                        let finalOpacity = currentOpacity;
                        if (isTransparent && child.material.userData.isWall) {
                            finalOpacity = Math.min(currentOpacity, 0.3);
                        }

                        if (child.material.transmission !== undefined) {
                             // Windows
                             child.material.opacity = finalOpacity * 0.5;
                        } else {
                             child.material.opacity = finalOpacity;
                        }
                    }
                });
            }
        });

        if (isWalkMode && pointerLockControls.isLocked) {
            const delta = (time - prevTime) / 1000;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            direction.z = Number(moveState.forward) - Number(moveState.backward);
            direction.x = Number(moveState.right) - Number(moveState.left);
            direction.normalize();

            if (moveState.forward || moveState.backward) velocity.z -= direction.z * 4000.0 * delta;
            if (moveState.left || moveState.right) velocity.x -= direction.x * 4000.0 * delta;

            pointerLockControls.moveRight(-velocity.x * delta);
            pointerLockControls.moveForward(-velocity.z * delta);
        } else {
            orbitControls.update();
        }

        prevTime = time;
        renderer.render(scene, camera);
    }
    animate();

    // Issues Integration
    let activeIssues = {};
    let latestFloorData = null;




    const waitForFirebase = () => {
        if (window.FirebaseStorageManager) {
            initFirebaseData();
        } else {
            setTimeout(waitForFirebase, 100);
        }
    };

    const initFirebaseData = () => {
        const residenceId = localStorage.getItem('dtech_residence_id');

        if (residenceId && window.FirebaseStorageManager) {
            // First load all existing floors
            window.FirebaseStorageManager.getAllFloors(residenceId).then(floors => {
                // Determine max floor
                const floorLevels = Object.keys(floors).map(Number).sort((a,b)=>a-b);
                const maxFloor = floorLevels.length > 0 ? floorLevels[floorLevels.length - 1] : 0;

                // Build all floors up to maxFloor
                for(let i=0; i<=maxFloor; i++) {
                    if (floors[i]) {
                        buildFloor(floors[i], i);
                        if (i !== targetFloorLevel) {
                            if (floorGroups[i]) floorGroups[i].visible = false;
                        } else {
                            latestFloorData = floors[i];
                            if (floorGroups[i]) floorGroups[i].visible = true;
                        }
                    }
                }

                if (floorLevels.length === 0) {
                     // Fallback
                     for(let i=0; i<=10; i++) {
                          window.fetchFloorData(i).then(data => {
                              if (data) {
                                  buildFloor(data, i);
                                  if (i === targetFloorLevel) {
                                      latestFloorData = data;
                                  } else {
                                      if (floorGroups[i]) floorGroups[i].visible = false;
                                  }
                              }
                          });
                     }
                }

                // Now setup listeners for changes (simple approach: just listen to current target floor for updates)
                window.FirebaseStorageManager.listenToFloorPlan(residenceId, targetFloorLevel, (data) => {
                    latestFloorData = data;
                    buildFloor(data, targetFloorLevel);
                });
            }).catch(e => {
                // local fallback if network error
                for(let i=0; i<=10; i++) {
                     window.fetchFloorData(i).then(data => {
                         if (data) {
                             buildFloor(data, i);
                             if (i === targetFloorLevel) {
                                 latestFloorData = data;
                                 if (floorGroups[i]) floorGroups[i].visible = true;
                             } else {
                                 if (floorGroups[i]) floorGroups[i].visible = false;
                             }
                         }
                     });
                }
            });

            // Listen to issue changes
            window.FirebaseStorageManager.listenToIssues(residenceId, (issues) => {
                activeIssues = issues;
                // Rebuild all to show issues
                window.FirebaseStorageManager.getAllFloors(residenceId).then(floors => {
                    Object.keys(floors).forEach(level => {
                        buildFloor(floors[level], parseInt(level));
                    });
                });
            });
        } else {
            // Load from local storage fallback
            for(let i=0; i<=10; i++) {
                 window.fetchFloorData(i).then(data => {
                     if (data) {
                         buildFloor(data, i);
                         if (i === targetFloorLevel) {
                             latestFloorData = data;
                         } else {
                             if (floorGroups[i]) floorGroups[i].visible = false;
                         }
                     }
                 });
            }
        }
    };
    waitForFirebase();




    // UI Listeners
    const targetFloorDisplay = document.getElementById('target-floor-display');

    // Add display all floors toggle
    const controlsGroup = document.querySelector('#btn-increase-floor').parentElement;
    const btnDisplayAll = document.createElement('button');
    btnDisplayAll.id = 'btn-display-all-floors';
    btnDisplayAll.innerText = 'Display All Floors';
    controlsGroup.appendChild(btnDisplayAll);

    btnDisplayAll.addEventListener('click', () => {
        isDisplayingAllFloors = !isDisplayingAllFloors;
        btnDisplayAll.innerText = isDisplayingAllFloors ? 'Hide All Floors' : 'Display All Floors';

        if (isDisplayingAllFloors) {
             // Show all floors by making them visible and rendering them if they haven't been built yet
             const residenceId = localStorage.getItem('dtech_residence_id');
             if (window.FirebaseStorageManager && residenceId) {
                  window.FirebaseStorageManager.getAllFloors(residenceId).then(floors => {
                      Object.keys(floors).forEach(level => {
                          if (!floorGroups[level]) {
                               buildFloor(floors[level], parseInt(level));
                          }
                          floorGroups[level].visible = true;
                      });
                  }).catch(e => {
                      // local fallback
                      for(let i=0; i<=10; i++) {
                           window.fetchFloorData(i).then(data => {
                               if (data) {
                                   if (!floorGroups[i]) {
                                        buildFloor(data, i);
                                   }
                                   if (floorGroups[i]) floorGroups[i].visible = true;
                               }
                           });
                      }
                  });
             } else {
                  // local fallback
                  for(let i=0; i<=10; i++) {
                       window.fetchFloorData(i).then(data => {
                           if (data) {
                               if (!floorGroups[i]) {
                                    buildFloor(data, i);
                               }
                               if (floorGroups[i]) floorGroups[i].visible = true;
                           }
                       });
                  }
             }
        } else {
             // Hide all except current
             Object.keys(floorGroups).forEach(level => {
                  if (parseInt(level) !== targetFloorLevel) {
                       // floorGroups[level].visible = false; handled by opacity
                  } else {
                       floorGroups[level].visible = true;
                  }
             });
        }
    });


    document.getElementById('btn-decrease-floor').addEventListener('click', () => {
        if (targetFloorLevel > 0) {
            targetFloorLevel--;
            targetFloorDisplay.innerText = targetFloorLevel;
            // Smoothly Move camera
            const p = camera.position;
            cameraTargetPos = new THREE.Vector3(p.x, targetFloorLevel * floorHeight + (p.y - (targetFloorLevel+1)*floorHeight), p.z);
            controlsTargetPos = new THREE.Vector3(orbitControls.target.x, targetFloorLevel * floorHeight, orbitControls.target.z);

            // Ensure floor is built ONLY IF it's not already built
            if (!floorGroups[targetFloorLevel]) {
                window.fetchFloorData(targetFloorLevel).then(data => {
                    if (data) {
                        latestFloorData = data;
                        buildFloor(latestFloorData, targetFloorLevel);
                        if (!isDisplayingAllFloors && floorGroups[targetFloorLevel]) floorGroups[targetFloorLevel].visible = true;
                    }
                });
            }

            if (!isDisplayingAllFloors) {
                 Object.keys(floorGroups).forEach(level => {
                      floorGroups[level].visible = (parseInt(level) === targetFloorLevel);
                 });
            } else {
                if(floorGroups[targetFloorLevel]) {
                    floorGroups[targetFloorLevel].visible = true;
                }
            }
        }
    });

    document.getElementById('btn-increase-floor').addEventListener('click', () => {
        targetFloorLevel++;
        targetFloorDisplay.innerText = targetFloorLevel;
        // Smoothly Move camera
            const p = camera.position;
            cameraTargetPos = new THREE.Vector3(p.x, targetFloorLevel * floorHeight + (p.y - (targetFloorLevel-1)*floorHeight), p.z);
            controlsTargetPos = new THREE.Vector3(orbitControls.target.x, targetFloorLevel * floorHeight, orbitControls.target.z);

        // Ensure floor is built ONLY IF it's not already built
        if (!floorGroups[targetFloorLevel]) {
            window.fetchFloorData(targetFloorLevel).then(data => {
                if (data) {
                    latestFloorData = data;
                    buildFloor(latestFloorData, targetFloorLevel);
                    if (!isDisplayingAllFloors && floorGroups[targetFloorLevel]) floorGroups[targetFloorLevel].visible = true;
                }
            });
        }

        if (!isDisplayingAllFloors) {
             Object.keys(floorGroups).forEach(level => {
                  floorGroups[level].visible = (parseInt(level) === targetFloorLevel);
             });
        } else {
            if(floorGroups[targetFloorLevel]) {
                floorGroups[targetFloorLevel].visible = true;
            }
        }
    });
    document.getElementById('json-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                latestFloorData = data;
                buildFloor(data, targetFloorLevel);
            } catch (err) {
                console.error("Failed to parse JSON", err);
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    });


    // Camera Presets
    document.getElementById('btn-cam-top').addEventListener('click', () => {
        isAutoWalking = false;
        cameraTargetPos = new THREE.Vector3(0, targetFloorLevel * floorHeight + 1500, 0);
        controlsTargetPos = new THREE.Vector3(0, targetFloorLevel * floorHeight, 0);
    });

    document.getElementById('btn-cam-iso').addEventListener('click', () => {
        isAutoWalking = false;
        cameraTargetPos = new THREE.Vector3(1000, targetFloorLevel * floorHeight + 1000, 1000);
        controlsTargetPos = new THREE.Vector3(0, targetFloorLevel * floorHeight, 0);
    });

    document.getElementById('btn-cam-side').addEventListener('click', () => {
        isAutoWalking = false;
        cameraTargetPos = new THREE.Vector3(1500, targetFloorLevel * floorHeight + 300, 0);
        controlsTargetPos = new THREE.Vector3(0, targetFloorLevel * floorHeight, 0);
    });

    // Auto Walkthrough
    document.getElementById('btn-walkthrough').addEventListener('click', () => {
        isAutoWalking = !isAutoWalking;
        if (isAutoWalking) {
            orbitControls.enabled = false;
            if (pointerLockControls.isLocked) pointerLockControls.unlock();

            // Build a curve from rooms / points
            const yOffset = targetFloorLevel * floorHeight + 150; // human height
            let points = [];

                        if (latestFloorData && latestFloorData.doors) {
                // Collect points around doors to simulate walking through passages/hallways
                latestFloorData.doors.forEach(door => {
                    const dx = door.position.x;
                    const dz = door.position.y;

                    // We'll add a point slightly offset from the door to represent the passage
                    // A proper pathfinding would need NavMesh, but this creates a reasonable tour
                    points.push(new THREE.Vector3(dx + 100, yOffset, dz + 100));
                    points.push(new THREE.Vector3(dx - 100, yOffset, dz - 100));
                });

                // If there are no doors, we can try to find open space (0,0)
                if (points.length === 0) {
                    points.push(new THREE.Vector3(0, yOffset, 0));
                }
            }

            if (points.length < 2) {
                // Default path if no rooms
                points = [
                    new THREE.Vector3(-500, yOffset, -500),
                    new THREE.Vector3(500, yOffset, -500),
                    new THREE.Vector3(500, yOffset, 500),
                    new THREE.Vector3(-500, yOffset, 500)
                ];
            }

            // Sort points loosely by distance to create a tour
            // A simple greedy TSP could work, but just leaving them as is or sorting by X is fine
            walkCurve = new THREE.CatmullRomCurve3(points, true); // closed loop
            walkProgress = 0;

        } else {
            orbitControls.enabled = true;
            // Return to iso
            cameraTargetPos = new THREE.Vector3(camera.position.x, camera.position.y + 500, camera.position.z + 500);
            controlsTargetPos = new THREE.Vector3(camera.position.x, targetFloorLevel * floorHeight, camera.position.z);
        }
        document.getElementById('btn-walkthrough').innerText = isAutoWalking ? "Stop Walkthrough" : "Auto Walkthrough (Passages)";
    });


    // Toggle Transparency
    document.getElementById('btn-toggle-transparent').addEventListener('click', () => {
        isTransparent = !isTransparent;
        wallsMaterials.forEach(mat => {
            mat.transparent = isTransparent;
            mat.opacity = isTransparent ? 0.3 : 1.0;
            mat.needsUpdate = true;
        });
    });

    // Walk Mode
    // Readonly Mode (hide inputs for students)
    const urlParams = new URLSearchParams(window.location.search);
    const isGuest = localStorage.getItem('dtech_guest_mode') === 'true';
    const isStudent = localStorage.getItem('dtech_user_role') === 'student';
    if (urlParams.get('readonly') === 'true' || isGuest || isStudent) {
        const floorInputs = document.getElementById('floor-inputs');
        if (floorInputs) {
            floorInputs.style.display = 'none';
        }
    }


    const walkBtn = document.getElementById('btn-walk-mode');
    const walkInstr = document.getElementById('walk-instructions');

    walkBtn.addEventListener('click', () => {
        isWalkMode = true;
        orbitControls.enabled = false;
        pointerLockControls.lock();
    });

    pointerLockControls.addEventListener('lock', () => {
        walkInstr.style.display = 'block';
        // Adjust camera position for human height
        camera.position.y = targetFloorLevel * floorHeight + 150;
    });

    pointerLockControls.addEventListener('unlock', () => {
        walkInstr.style.display = 'none';
        isWalkMode = false;
        orbitControls.enabled = true;

        // Return camera to a reasonable orbit position
        const p = camera.position;
        camera.position.set(p.x, p.y + 500, p.z + 500);
        orbitControls.target.set(p.x, targetFloorLevel * floorHeight, p.z);
    });

    // Building the 3D model

    // Floor groups dictionary
    function buildFloor(data, level) {
        data = window.safeParse(data);
        if (!data || !data.walls) return;

        // Clear existing walls for this floor
        if (floorGroups[level]) {
            wallsGroup.remove(floorGroups[level]);
        }

        const currentFloorGroup = new THREE.Group();
        floorGroups[level] = currentFloorGroup;
        wallsGroup.add(currentFloorGroup);

        wallsMaterials = []; // Note: this will overwrite for all floors, but fine for toggle

        const yOffset = level * floorHeight;

        let canvasW = 1000;
        let canvasH = 800;
        if (data.canvas) {
            canvasW = data.canvas.width || canvasW;
            canvasH = data.canvas.height || canvasH;
        }

        const scale = data.scale || 100;

        // Draw Rooms
        if (data.rooms && data.rooms.length > 0) {
            data.rooms.forEach((room, idx) => {
                if (!room.boundary || room.boundary.length < 3) return;

                const roomShape = new THREE.Shape();
                roomShape.moveTo(room.boundary[0].x, room.boundary[0].y);
                for(let i=1; i<room.boundary.length; i++) {
                    roomShape.lineTo(room.boundary[i].x, room.boundary[i].y);
                }

                const extrudeSettings = { depth: 5, bevelEnabled: false };
                const roomGeom = new THREE.ExtrudeGeometry(roomShape, extrudeSettings);

                let color = new THREE.Color().setHSL((idx * 137.5) % 360 / 360, 0.5, 0.8);
                if (activeIssues && activeIssues[room.id]) {
                    color = new THREE.Color(0xff4444); // Red tint for faulty rooms
                }
                const roomMat = new THREE.MeshLambertMaterial({ color: color });

                const roomMesh = new THREE.Mesh(roomGeom, roomMat);
                roomMesh.rotation.x = Math.PI / 2; // Lay flat
                roomMesh.position.y = yOffset;
                roomMesh.receiveShadow = true;
                currentFloorGroup.add(roomMesh);
            });
        } else {
            // Base floor if no rooms
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
            const floorGeometry = new THREE.PlaneGeometry(canvasW, canvasH);
            const floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
            floorPlane.rotation.x = -Math.PI / 2;
            floorPlane.position.set(canvasW / 2, yOffset, canvasH / 2);
            floorPlane.receiveShadow = true;
            currentFloorGroup.add(floorPlane);
        }

        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
        wallMaterial.userData = { isWall: true };
        if (isTransparent) {
            wallMaterial.transparent = true;
            wallMaterial.opacity = 0.3;
        }
        wallsMaterials.push(wallMaterial);


        const wallHeight = floorHeight - 10;

        // Helper to check intersection and return segments
        function cutWall(wall, cutouts) {
            const sx = wall.start.x, sy = wall.start.y;
            const ex = wall.end.x, ey = wall.end.y;

            const wallLength = Math.hypot(ex-sx, ey-sy);
            const dirX = (ex-sx)/wallLength;
            const dirY = (ey-sy)/wallLength;

            let segments = [{start: 0, end: wallLength}];
            let topSegments = [];
            let bottomSegments = [];

            cutouts.forEach(cut => {
                const cx = cut.position.x;
                const cy = cut.position.y;

                const dot = (cx - sx)*dirX + (cy - sy)*dirY;
                const w = cut.width || (cut.type==='door' ? 80 : 100);

                const distToLine = Math.abs((ex-sx)*(sy-cy) - (sx-cx)*(ey-sy)) / wallLength;
                let thickness = wall.thickness;
                if (!thickness || thickness < 1) thickness = (wall.thickness || 0.15) * scale;

                if (distToLine < thickness + w/2) {
                    const cutStart = dot - w/2;
                    const cutEnd = dot + w/2;

                    let newSegs = [];
                    segments.forEach(seg => {
                        if (cutEnd <= seg.start || cutStart >= seg.end) {
                            newSegs.push(seg);
                        } else {
                            if (cutStart > seg.start) newSegs.push({start: seg.start, end: cutStart});
                            if (cutEnd < seg.end) newSegs.push({start: cutEnd, end: seg.end});

                            if (cut.type === 'door') {
                                topSegments.push({start: Math.max(seg.start, cutStart), end: Math.min(seg.end, cutEnd), type: 'door'});
                            } else {
                                topSegments.push({start: Math.max(seg.start, cutStart), end: Math.min(seg.end, cutEnd), type: 'window'});
                                bottomSegments.push({start: Math.max(seg.start, cutStart), end: Math.min(seg.end, cutEnd), type: 'window'});
                            }
                        }
                    });
                    segments = newSegs;
                }
            });
            return { full: segments, top: topSegments, bottom: bottomSegments };
        }

        let allCutouts = [];
        if (data.doors) allCutouts.push(...data.doors.map(d => ({...d, type: 'door'})));
        if (data.windows) allCutouts.push(...data.windows.map(w => ({...w, type: 'window'})));

        data.walls.forEach(wall => {
            const sx = wall.start.x, sy = wall.start.y;
            const ex = wall.end.x, ey = wall.end.y;
            const wallLength = Math.hypot(ex-sx, ey-sy);

            let thickness = wall.thickness;
            if (!thickness || thickness < 1) thickness = (wall.thickness || 0.15) * scale;

            const dx = ex - sx;
            const dy = ey - sy;
            const angle = -Math.atan2(dy, dx);

            const cuts = cutWall(wall, allCutouts);

            const buildSeg = (seg, h, yOff) => {
                const len = seg.end - seg.start;
                if (len <= 0) return;
                const segMid = seg.start + len/2;
                const midX = sx + (dx/wallLength)*segMid;
                const midY = sy + (dy/wallLength)*segMid;

                const geom = new THREE.BoxGeometry(len, h, thickness);
                const mesh = new THREE.Mesh(geom, wallMaterial);
                mesh.position.set(midX, yOffset + yOff + h/2, midY);
                mesh.rotation.y = angle;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                currentFloorGroup.add(mesh);
            };

            cuts.full.forEach(seg => buildSeg(seg, wallHeight, 0));
            cuts.top.forEach(seg => {
                if (seg.type === 'door') {
                     buildSeg(seg, wallHeight - 200, 200);
                } else {
                     buildSeg(seg, wallHeight - 200, 200);
                }
            });
            cuts.bottom.forEach(seg => {
                if (seg.type === 'window') {
                     buildSeg(seg, 80, 0);
                }
            });
        });


        // Add Doors
        if (data.doors) {
            const doorMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
            data.doors.forEach(door => {
                const w = door.width || 80;
                const h = 200; // typical door height
                const t = 10; // thin panel

                const doorGeom = new THREE.BoxGeometry(w, h, t);
                const doorMesh = new THREE.Mesh(doorGeom, doorMat);

                doorMesh.position.set(door.position.x, yOffset + h / 2, door.position.y);

                // Partially open
                const angle = door.rotation ? door.rotation : 0;
                doorMesh.rotation.y = -angle + Math.PI / 4; // Open by 45 degrees

                doorMesh.castShadow = true;
                currentFloorGroup.add(doorMesh);
            });
        }

        // Add Windows
        if (data.windows) {
            const winMat = new THREE.MeshPhysicalMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.5,
                roughness: 0.1,
                transmission: 0.9,
            });
            data.windows.forEach(win => {
                const w = win.width || 100;
                const h = 120; // window height
                const t = 15;

                const winGeom = new THREE.BoxGeometry(w, h, t);
                const winMesh = new THREE.Mesh(winGeom, winMat);

                // Position typically off ground
                winMesh.position.set(win.position.x, yOffset + 80 + h / 2, win.position.y);

                const angle = win.rotation ? win.rotation : 0;
                winMesh.rotation.y = -angle;

                currentFloorGroup.add(winMesh);
            });
        }

        // Add Objects
        if (data.objects) {
            data.objects.forEach(obj => {
                const w = obj.width || 50;
                const d = obj.height || 50; // In 2D, height is depth
                const h = 80; // default height if unknown

                let color = 0xaaaaaa;
                // Assign basic colors based on type
                if (obj.type.includes('bed')) color = 0x4a90e2;
                else if (obj.type.includes('sofa')) color = 0xe24a4a;
                else if (obj.type.includes('table') || obj.type.includes('desk')) color = 0x8b5a2b;
                else if (obj.type.includes('toilet') || obj.type.includes('bath')) color = 0xffffff;

                let isFaulty = false;
                let faultySeverity = 'warning';
                if (activeIssues && activeIssues[obj.id]) {
                    isFaulty = true;
                    faultySeverity = activeIssues[obj.id].severity;
                    if (faultySeverity === 'critical') {
                        color = 0xff0000; // Bright red
                    } else {
                        color = 0xffa500; // Orange/Yellow for maintenance
                    }
                }

                const objMat = new THREE.MeshLambertMaterial({ color: color });
                                const objGroup = new THREE.Group();
                const objGeom = new THREE.BoxGeometry(w, h, d);
                const objMesh = new THREE.Mesh(objGeom, objMat);

                // Enhance specific models
                if (obj.type.includes('bed')) {
                    // Add a pillow
                    const pillowMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                    const pillowGeom = new THREE.BoxGeometry(w * 0.8, 10, d * 0.2);
                    const pillowMesh = new THREE.Mesh(pillowGeom, pillowMat);
                    pillowMesh.position.set(0, h/2 + 5, -d/2 + (d * 0.2)/2 + 5);
                    objGroup.add(pillowMesh);
                } else if (obj.type.includes('table') || obj.type.includes('desk')) {
                    // Make it look like a table (top and legs)
                    objMesh.scale.set(1, 0.1, 1);
                    objMesh.position.set(0, h/2 - (h*0.1)/2, 0);

                                        const legGeom = new THREE.BoxGeometry(5, h, 5);
                    const positions = [
                        [w/2-5, 0, d/2-5], [-w/2+5, 0, d/2-5],
                        [w/2-5, 0, -d/2+5], [-w/2+5, 0, -d/2+5]
                    ];
                    positions.forEach(pos => {
                        const leg = new THREE.Mesh(legGeom, objMat);
                        leg.position.set(pos[0], pos[1], pos[2]);
                        objGroup.add(leg);
                    });
                }

                objMesh.castShadow = true;
                objMesh.receiveShadow = true;
                objGroup.add(objMesh);
                objGroup.position.set(obj.position.x, yOffset + h / 2, obj.position.y);

                if (obj.rotation) {
                    objGroup.rotation.y = -obj.rotation;
                }

                currentFloorGroup.add(objGroup);
            });
        }

        if (level === 0) {
            camera.position.set(canvasW / 2, 800, canvasH + 800);
            orbitControls.target.set(canvasW / 2, 0, canvasH / 2);
            orbitControls.update();
        }

        console.log(`Floor ${level} generated.`);
    }

});