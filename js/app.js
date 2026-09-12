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
});