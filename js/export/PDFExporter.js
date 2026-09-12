class PDFExporter {
    static export(model, canvas) {
        if (typeof window.jspdf === 'undefined') {
            alert("jsPDF library is not loaded.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const data = model.data;
        const scale = data.scale;

        // Add Title
        doc.setFontSize(20);
        doc.text(data.name || 'Floor Plan', 10, 20);

        // Add Metadata
        doc.setFontSize(12);
        doc.text(`Scale: 1 unit = ${scale} m`, 10, 30);

        let totalArea = 0;
        data.rooms.forEach(r => totalArea += r.area);
        doc.text(`Total Area: ${totalArea.toFixed(2)} sqm`, 10, 38);

        // Calculate bounding box of the floor plan to center it in PDF
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (data.walls.length > 0) {
            data.walls.forEach(w => {
                minX = Math.min(minX, w.start.x, w.end.x);
                minY = Math.min(minY, w.start.y, w.end.y);
                maxX = Math.max(maxX, w.start.x, w.end.x);
                maxY = Math.max(maxY, w.start.y, w.end.y);
            });
        } else {
            minX = 0; minY = 0; maxX = 100; maxY = 100; // Default
        }

        const fpWidth = maxX - minX;
        const fpHeight = maxY - minY;

        // A4 landscape dimensions: 297 x 210 mm
        // Leave margins: x: 20mm, y: 50mm (top for title)
        const pdfAvailableWidth = 297 - 40;
        const pdfAvailableHeight = 210 - 70;

        // Calculate scaling factor to fit plan into PDF
        const scaleFactor = Math.min(
            pdfAvailableWidth / (fpWidth || 1),
            pdfAvailableHeight / (fpHeight || 1)
        ) * 0.9; // 90% of available space

        const offsetX = 20 + (pdfAvailableWidth - fpWidth * scaleFactor) / 2 - minX * scaleFactor;
        const offsetY = 50 + (pdfAvailableHeight - fpHeight * scaleFactor) / 2 - minY * scaleFactor;

        // Draw Rooms
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(240, 240, 240);
        data.rooms.forEach(room => {
            if (room.boundary && room.boundary.length > 2) {
                const lines = room.boundary.map(p => [p.x * scaleFactor + offsetX, p.y * scaleFactor + offsetY]);
                doc.lines(lines.slice(1), lines[0][0], lines[0][1], [1, 1], 'F', true);

                // Room text
                let cx = 0, cy = 0;
                room.boundary.forEach(p => { cx += p.x; cy += p.y; });
                cx /= room.boundary.length;
                cy /= room.boundary.length;

                doc.setFontSize(10);
                doc.setTextColor(50, 50, 50);
                doc.text(room.name, cx * scaleFactor + offsetX, cy * scaleFactor + offsetY, { align: 'center' });
                doc.setFontSize(8);
                doc.text(`${room.area.toFixed(2)} sqm`, cx * scaleFactor + offsetX, cy * scaleFactor + offsetY + 5, { align: 'center' });
            }
        });

        // Draw Walls
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(2);
        data.walls.forEach(wall => {
            doc.line(
                wall.start.x * scaleFactor + offsetX,
                wall.start.y * scaleFactor + offsetY,
                wall.end.x * scaleFactor + offsetX,
                wall.end.y * scaleFactor + offsetY
            );
        });

        // Save PDF
        doc.save(`${data.name || 'floorplan'}.pdf`);
    }
}

// Make it available globally
window.PDFExporter = PDFExporter;