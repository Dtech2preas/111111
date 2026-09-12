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
        doc.setTextColor(44, 62, 80);
        doc.text(data.name || 'Floor Plan', 15, 20);

        // Add Metadata / Legend area
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const date = new Date().toLocaleDateString();
        doc.text(`Date: ${date}`, 15, 28);
        doc.text(`Scale: 1 unit = ${scale} m`, 15, 34);

        let totalArea = 0;
        data.rooms.forEach(r => totalArea += r.area);
        doc.text(`Total Area: ${totalArea.toFixed(2)} m²`, 15, 40);

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 45, 282, 45); // horizontal rule

        // Calculate bounding box of the floor plan to center it in PDF
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        const updateBounds = (p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        };

        if (data.walls.length > 0) {
            data.walls.forEach(w => {
                updateBounds(w.start);
                updateBounds(w.end);
            });
            // Include objects in bounds
            if (data.objects) {
                data.objects.forEach(o => {
                    updateBounds({x: o.position.x - o.width/2, y: o.position.y - o.height/2});
                    updateBounds({x: o.position.x + o.width/2, y: o.position.y + o.height/2});
                });
            }
        } else {
            minX = 0; minY = 0; maxX = 100; maxY = 100;
        }

        // Add padding to bounds
        const pad = 20;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;

        const fpWidth = maxX - minX;
        const fpHeight = maxY - minY;

        // A4 landscape dimensions: 297 x 210 mm
        const pdfAvailableWidth = 297 - 30; // 15mm margins
        const pdfAvailableHeight = 210 - 60; // 45mm top margin, 15mm bottom

        // Calculate scaling factor to fit plan into PDF
        const scaleFactor = Math.min(
            pdfAvailableWidth / (fpWidth || 1),
            pdfAvailableHeight / (fpHeight || 1)
        );

        const offsetX = 15 + (pdfAvailableWidth - fpWidth * scaleFactor) / 2 - minX * scaleFactor;
        const offsetY = 50 + (pdfAvailableHeight - fpHeight * scaleFactor) / 2 - minY * scaleFactor;

        // Helper to transform coordinates
        const tX = (x) => x * scaleFactor + offsetX;
        const tY = (y) => y * scaleFactor + offsetY;

        // Draw Rooms
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.setLineWidth(0.2);

        data.rooms.forEach(room => {
            if (room.boundary && room.boundary.length > 2) {
                const lines = room.boundary.map(p => [tX(p.x), tY(p.y)]);
                doc.lines(lines.slice(1), lines[0][0], lines[0][1], [1, 1], 'F', true);

                // Room text
                let cx = 0, cy = 0;
                room.boundary.forEach(p => { cx += p.x; cy += p.y; });
                cx /= room.boundary.length;
                cy /= room.boundary.length;

                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(50, 50, 50);
                doc.text(room.name, tX(cx), tY(cy), { align: 'center' });
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);
                doc.text(`${room.area.toFixed(2)} m²`, tX(cx), tY(cy) + 4, { align: 'center' });
            }
        });

        // Draw Objects (Furniture)
        if(data.objects) {
            doc.setDrawColor(150, 150, 150);
            doc.setFillColor(230, 230, 230);
            doc.setLineWidth(0.2);
            doc.setFontSize(6);
            doc.setTextColor(80, 80, 80);

            data.objects.forEach(obj => {
                // PDF doesn't have an easy center+rotate rect out of the box,
                // so we approximate or use advanced transforms if available.
                // For simplicity here, we draw standard bounding rects
                const w = obj.width * scaleFactor;
                const h = obj.height * scaleFactor;
                const x = tX(obj.position.x) - w/2;
                const y = tY(obj.position.y) - h/2;

                doc.rect(x, y, w, h, 'FD');
                doc.text(obj.type, tX(obj.position.x), tY(obj.position.y), { align: 'center', baseline: 'middle' });
            });
        }

        // Draw Doors & Windows (Simplistic representations)
        doc.setLineWidth(0.5);
        if(data.windows) {
            doc.setDrawColor(52, 152, 219); // Blue
            doc.setFillColor(236, 240, 241);
            data.windows.forEach(win => {
                const w = win.width * scaleFactor;
                const h = 10 * scaleFactor; // approx thickness

                // Advanced: if we wanted real rotation in PDF we'd calculate corner points.
                // For MVP we just draw a dot or basic rect.
                doc.rect(tX(win.position.x) - w/2, tY(win.position.y) - h/2, w, h, 'FD');
            });
        }

        // Draw Walls
        doc.setDrawColor(44, 62, 80);
        data.walls.forEach(wall => {
            doc.setLineWidth((wall.thickness || 10) * scaleFactor);
            doc.line(
                tX(wall.start.x), tY(wall.start.y),
                tX(wall.end.x), tY(wall.end.y)
            );
        });

        // Draw Labels
        if(data.labels) {
            data.labels.forEach(lbl => {
                doc.setFontSize(lbl.fontSize * scaleFactor * 2); // approximate scaling
                doc.setTextColor(lbl.color || '#333333');
                doc.text(lbl.text, tX(lbl.position.x), tY(lbl.position.y), { align: 'center' });
            });
        }

        // Save PDF
        doc.save(`${data.name || 'floorplan'}.pdf`);
    }
}

// Make it available globally
window.PDFExporter = PDFExporter;