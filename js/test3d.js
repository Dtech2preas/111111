document.addEventListener('DOMContentLoaded', () => {
    // Basic Three.js setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 1000, 1000);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 1000, 500);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.top = 2000;
    directionalLight.shadow.camera.bottom = -2000;
    directionalLight.shadow.camera.left = -2000;
    directionalLight.shadow.camera.right = 2000;
    scene.add(directionalLight);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(5000, 50, 0x888888, 0xdddddd);
    scene.add(gridHelper);

    // State
    let targetFloorLevel = 0;
    const floorHeight = 300; // units
    const wallsGroup = new THREE.Group();
    scene.add(wallsGroup);

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // UI Listeners
    const targetFloorDisplay = document.getElementById('target-floor-display');

    document.getElementById('btn-decrease-floor').addEventListener('click', () => {
        if (targetFloorLevel > 0) {
            targetFloorLevel--;
            targetFloorDisplay.innerText = targetFloorLevel;
        }
    });

    document.getElementById('btn-increase-floor').addEventListener('click', () => {
        targetFloorLevel++;
        targetFloorDisplay.innerText = targetFloorLevel;
    });

    document.getElementById('json-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                buildFloor(data, targetFloorLevel);
            } catch (err) {
                console.error("Failed to parse JSON", err);
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);

        // Reset file input so same file can be uploaded again if needed
        event.target.value = '';
    });

    // Building the 3D model
    function buildFloor(data, level) {
        if (!data || !data.walls) return;

        const yOffset = level * floorHeight;

        // Create floor base based on canvas size (if available in JSON)
        let canvasW = 1000;
        let canvasH = 800;
        if (data.canvas) {
            canvasW = data.canvas.width || canvasW;
            canvasH = data.canvas.height || canvasH;
        }

        const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.DoubleSide });

        // Simple floor plane for visual reference
        const floorGeometry = new THREE.PlaneGeometry(canvasW, canvasH);
        const floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
        floorPlane.rotation.x = -Math.PI / 2;
        // Center it roughly or align with origin (2D canvas usually starts top-left, 3D center is origin)
        // Adjusting origin to put 2D (0,0) at top-left
        floorPlane.position.set(canvasW / 2, yOffset, canvasH / 2);
        floorPlane.receiveShadow = true;
        wallsGroup.add(floorPlane);

        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
        const wallHeight = floorHeight - 10; // slightly less than full height to show separation between floors

        data.walls.forEach(wall => {
            const startX = wall.start.x;
            const startZ = wall.start.y; // 2D Y becomes 3D Z
            const endX = wall.end.x;
            const endZ = wall.end.y;

            const dx = endX - startX;
            const dz = endZ - startZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            // Wall thickness from 2D (usually small, maybe scale it up for visualization if too small, or use as is)
            let thickness = wall.thickness;
            // the JSON usually has thickness in 'units' (meters) but canvas coordinates in pixels.
            // In 2D, the thickness in pixels is usually used. The JSON might store scale.
            // Let's assume a fixed visual thickness if it's too small.
            if (!thickness || thickness < 1) {
                // If it's stored in meters (e.g. 0.15) and scale is say 100
                const scale = data.scale || 100;
                thickness = (wall.thickness || 0.15) * scale;
            }

            // Create box for wall
            const wallGeom = new THREE.BoxGeometry(length, wallHeight, thickness);
            const wallMesh = new THREE.Mesh(wallGeom, wallMaterial);

            // Position at center of the wall line
            const midX = (startX + endX) / 2;
            const midZ = (startZ + endZ) / 2;

            wallMesh.position.set(midX, yOffset + wallHeight / 2, midZ);

            // Rotate to match line angle
            const angle = -Math.atan2(dz, dx); // Note: negative dz for rotation logic
            wallMesh.rotation.y = angle;

            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;

            wallsGroup.add(wallMesh);
        });

        // Auto-center camera if this is the first floor
        if (level === 0) {
            camera.position.set(canvasW / 2, 1000, canvasH + 500);
            controls.target.set(canvasW / 2, 0, canvasH / 2);
            controls.update();
        }

        console.log(`Floor ${level} generated with ${data.walls.length} walls.`);
    }
});