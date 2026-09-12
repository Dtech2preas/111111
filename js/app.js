// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing D-TECH Residence Floor Plan System...");

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        console.warn("jsPDF is not loaded. PDF export will not work.");
    }

    // Main App components
    const model = new FloorPlanModel();
    const controller = new FloorPlanController(model);
    const ui = new CanvasUI(controller, 'floorplan-canvas');

    // Attempt to load from Firebase/Local
    setTimeout(async () => {
        const loaded = await controller.loadLocal();
        if (loaded) {
            ui.render();
        } else {
            // Setup default rooms if no plan exists
            const w = ui.canvas.width || 1000;
            const h = ui.canvas.height || 800;
            model.addWall({x: 100, y: 100}, {x: w-100, y: 100});
            model.addWall({x: w-100, y: 100}, {x: w-100, y: h-100});
            model.addWall({x: w-100, y: h-100}, {x: 100, y: h-100});
            model.addWall({x: 100, y: h-100}, {x: 100, y: 100});
            ui.render();
        }
    }, 500); // Wait for Firebase to inject
});