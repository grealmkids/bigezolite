import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student } from './student.service';

interface PDFHeader {
  schoolName: string;
  term: string;
  year: string;
  generatedDate: string;
  totalStudents: number;
  filterInfo?: string;
  statusLabel?: string;
  statusTheme?: 'paid' | 'pending' | 'defaulter';
  hideTerm?: boolean;
  hideYear?: boolean;
  badgeUrl?: string;
  includePhotos?: boolean;
  themeColor?: string;
  themeTextColor?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  constructor() { }

  generateFeesDetailsPDF(rows: Array<{ reg: string; lin?: string; name: string; klass: string; feesStatus: string; feeName?: string; term?: number; year?: number; total?: number; paid?: number; balance?: number; phone: string }>, header: PDFHeader): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Theming colors based on selected status
    const themes: any = {
      paid: { main: [16, 122, 57], accent: [198, 246, 213] },
      pending: { main: [25, 118, 210], accent: [227, 242, 253] },
      defaulter: { main: [220, 38, 38], accent: [254, 202, 202] },
      default: { main: [0, 89, 179], accent: [255, 193, 7] },
    };
    const themeKey = (header.statusTheme || 'default') as keyof typeof themes;
    const col = themes[themeKey] || themes.default;

    // Header
    doc.setFillColor(col.main[0], col.main[1], col.main[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFillColor(col.accent[0], col.accent[1], col.accent[2]);
    doc.rect(0, 35, pageWidth, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(header.schoolName, pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Fees Details Report', pageWidth / 2, 21, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const leftX = 14; const rightX = pageWidth - 14;
    doc.setTextColor(255, 255, 255);
    doc.text(`Academic Year: ${header.year}`, leftX, 29);
    const termText1 = (() => { const t = String(header.term || ''); return /^\s*term\b/i.test(t) ? t : (t ? `Term ${t}` : ''); })();
    if (termText1) doc.text(termText1, rightX, 29, { align: 'right' });

    // Meta
    doc.setTextColor(0, 0, 0);
    const metaY = 42;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${header.generatedDate}`, leftX, metaY);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(col.main[0], col.main[1], col.main[2]);
    doc.text(`Total Records: ${header.totalStudents}`, rightX, metaY, { align: 'right' });
    if (header.filterInfo) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Filters Applied: ${header.filterInfo}`, pageWidth / 2, metaY + 4, { align: 'center' });
    }

    // Status stamp above table if provided
    let tableStartYOffset = header.filterInfo ? metaY + 8 : metaY + 2;
    if (header.statusLabel) {
      const stampY = tableStartYOffset;
      const label = String(header.statusLabel).toUpperCase();
      const textW = doc.getTextWidth(label) + 10;
      const x = (pageWidth - textW) / 2;
      doc.setFillColor(col.accent[0], col.accent[1], col.accent[2]);
      doc.roundedRect(x, stampY, textW, 8, 3, 3, 'F');
      doc.setTextColor(col.main[0], col.main[1], col.main[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, pageWidth / 2, stampY + 5.5, { align: 'center' });
      tableStartYOffset += 12;
    }

    // Table
    const includeTerm = !header.hideTerm;
    const includeYear = !header.hideYear;
    const head = [[
      '#', 'Reg Number', 'LIN', 'Student Name', 'Class', 'Fees Status', 'Fee',
      ...(includeTerm ? ['Term'] : []),
      ...(includeYear ? ['Year'] : []),
      'Total Due', 'Paid', 'Balance', 'Parent Phone'
    ]];
    const fmt0 = (n: any) => {
      const v = Number(n || 0);
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };
    const body = rows.map((r, i) => {
      const base: any[] = [
        i + 1,
        r.reg,
        r.lin || '-',
        r.name,
        r.klass,
        (r.feesStatus || '').toLowerCase() === 'pending' ? 'Partially Paid' : (r.feesStatus || ''),
        r.feeName || 'School Fees',
      ];
      if (includeTerm) base.push(r.term ?? '');
      if (includeYear) base.push(r.year ?? '');
      base.push(
        fmt0(r.total),
        fmt0(r.paid),
        fmt0(r.balance),
        r.phone
      );
      return base;
    });

    autoTable(doc, {
      startY: tableStartYOffset,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.25, font: 'helvetica', textColor: [40, 40, 40], halign: 'left' },
      headStyles: { fillColor: [52, 73, 94], textColor: [255, 255, 255], fontSize: 12, fontStyle: 'bold', halign: 'left', cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 8 }, // #
        1: { cellWidth: 24 }, // Reg
        2: { cellWidth: 24 }, // LIN
        3: { cellWidth: 44 }, // Name
        4: { cellWidth: 18 }, // Class
        5: { cellWidth: 20 }, // Status
        6: { cellWidth: 26 }, // Fee
        7: { cellWidth: includeTerm ? 14 : (includeYear ? 18 : 22) }, // Term or Total Due depending on shifts
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => {
        if (data.column.index === 10 && data.section === 'body') {
          // Balance color: red if > 0 else green
          const raw = (data.cell.raw as string) || '0';
          const numeric = Number(String(raw).replace(/[^0-9.-]/g, '')) || 0;
          data.cell.styles.textColor = numeric > 0 ? [198, 40, 40] : [46, 125, 50];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 5 && data.section === 'body') {
          const status = (data.cell.raw as string || '').toLowerCase();
          let bg: [number, number, number] = [255, 255, 255]; let tx: [number, number, number] = [40, 40, 40];
          if (status === 'paid') { bg = [198, 246, 213]; tx = [22, 163, 74]; }
          if (status === 'pending' || status === 'partially paid') { bg = [227, 242, 253]; tx = [25, 118, 210]; }
          if (status === 'defaulter') { bg = [254, 202, 202]; tx = [220, 38, 38]; }
          data.cell.styles.fillColor = bg; data.cell.styles.textColor = tx; data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
      tableWidth: pageWidth - 28 // Explicitly set width to page width minus margins
    });

    const fileName = `Fees_Details_${header.year}_${header.term}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generates a professional PDF with student data
   * Designed with Adobe-quality styling
   */
  async generateStudentListPDF(students: Student[], header: PDFHeader): Promise<void> {
    // Create PDF in landscape for better table visibility
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ========== HEADER SECTION (Professional Adobe-style) ==========

    // Theme Logic
    const themeColor = header.themeColor || '#ffffff'; // Default to white
    const themeTextColor = header.themeTextColor || '#000000'; // Default to black

    // Background gradient effect (simulated with filled rectangles)
    doc.setFillColor(themeColor);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Set text color
    const tcVec = this.hexToRgb(themeTextColor);
    doc.setTextColor(tcVec[0], tcVec[1], tcVec[2]);

    // Accent stripe - REMOVED as per user request
    // doc.setFillColor(255, 193, 7);
    // doc.rect(0, 35, pageWidth, 2, 'F');

    let textStartX = pageWidth / 2;
    let align: 'center' | 'left' | 'right' | 'justify' = 'center';

    // Badge Logic
    if (header.badgeUrl) {
      try {
        const badgeData = await this.getBase64ImageFromURL(header.badgeUrl);
        console.log('Badge loaded, length:', badgeData.length, 'Prefix:', badgeData.substring(0, 50));

        // Calculate dimensions to preserve aspect ratio
        const dims = await new Promise<{ w: number, h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 28, h: 28 }); // Default to square if load fails
          img.src = badgeData;
        });

        const maxW = 28;
        const maxH = 28;
        let w = maxW;
        let h = maxH;

        if (dims.w > 0 && dims.h > 0) {
          const aspect = dims.w / dims.h;
          if (aspect > 1) {
            // Wider than tall: constrain width
            h = maxW / aspect;
          } else {
            // Taller than wide: constrain height
            w = maxH * aspect;
          }
        }

        // Center the image within the 28x28 box
        const x = 14 + (maxW - w) / 2;
        const y = 4 + (maxH - h) / 2;

        // Normalize image to valid PNG using canvas
        try {
          const normalizedData = await this.normalizeImage(badgeData);
          doc.addImage(normalizedData, 'PNG', x, y, w, h);
        } catch (normErr) {
          console.warn('Image normalization failed, trying raw addImage with smart detection', normErr);

          // Fallback: Magic Byte Detection
          const rawBase64 = badgeData.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
          const detectedFormat = this.detectImageFormat(rawBase64);
          console.log('Fallback: Detected format via magic bytes:', detectedFormat);

          let formatToTry = detectedFormat === 'UNKNOWN' ? 'PNG' : detectedFormat;

          try {
            doc.addImage(rawBase64, formatToTry, x, y, w, h);
          } catch (firstErr) {
            console.warn(`Fallback: Failed as ${formatToTry}, trying opposite`, firstErr);
            const otherFormat = formatToTry === 'PNG' ? 'JPEG' : 'PNG';
            try {
              doc.addImage(rawBase64, otherFormat, x, y, w, h);
            } catch (secondErr) {
              console.error('Fallback: All attempts failed', secondErr);
            }
          }
        }

        // Shift text to the right
        textStartX = 50;
        align = 'left';
      } catch (err) {
        console.warn('Failed to load badge image for PDF', err);
        // Fallback to centered if badge fails
      }
    }

    // School Name - Large, Bold
    // Text color already set above based on theme
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(header.schoolName, textStartX, 14, { align: align });

    // Document Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Registry', textStartX, 23, { align: align });

    // Header Info Bar - Two columns (shifted if badge exists)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const rightX = pageWidth - 14;

    if (header.badgeUrl) {
      // If badge is present, put Year/Term on the right side of the header bar
      doc.text(`Year: ${header.year}`, rightX, 14, { align: 'right' });
      const termText = (() => { const t = String(header.term || ''); return /^\s*term\b/i.test(t) ? t : (t ? `Term ${t}` : ''); })();
      if (termText) doc.text(termText, rightX, 23, { align: 'right' });
    } else {
      // Original centered layout
      const leftX = 14;
      doc.text(`Academic Year: ${header.year}`, leftX, 29);
      const termText2 = (() => { const t = String(header.term || ''); return /^\s*term\b/i.test(t) ? t : (t ? `Term ${t}` : ''); })();
      if (termText2) doc.text(termText2, rightX, 29, { align: 'right' });
    }

    // Reset text color for body
    doc.setTextColor(0, 0, 0);

    // ========== METADATA SECTION ==========
    const metaY = 42;
    const leftX = 14;

    // Left side - Generated date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${header.generatedDate}`, leftX, metaY);

    // Right side - Total Students (Split styling)
    const countStr = String(header.totalStudents);

    // Draw Number first (to align right correctly)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 89, 179); // Blue color
    doc.text(countStr, rightX, metaY, { align: 'right' });

    // Calculate width to position label
    const countWidth = doc.getTextWidth(countStr);

    // Draw Label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0); // Black text for label
    doc.text('Total Records:', rightX - countWidth - 2, metaY, { align: 'right' });

    if (header.filterInfo) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Filters Applied: ${header.filterInfo}`, pageWidth / 2, metaY + 4, { align: 'center' });
    }

    // ========== PHOTOS PRELOADING ==========
    const photoMap = new Map<number, string>();
    if (header.includePhotos) {
      // Fetch photos in parallel
      const promises = students.map(async (s) => {
        if (s.student_photo_url) {
          try {
            // Use existing getBase64ImageFromURL method
            const base64 = await this.getBase64ImageFromURL(s.student_photo_url);
            // Normalize it to ensure it's a valid PNG/JPEG for jsPDF
            try {
              const normalized = await this.normalizeImage(base64);
              photoMap.set(s.student_id, normalized);
            } catch {
              // If normalization fails, try using raw base64
              photoMap.set(s.student_id, base64);
            }
          } catch (e) {
            console.warn(`Failed to load photo for student ${s.student_id}`, e);
          }
        }
      });
      await Promise.all(promises);
    }

    // ========== TABLE SECTION (Adobe-quality styling) ==========

    // Prepare columns
    // Prepare columns
    const columns = ['#'];
    if (header.includePhotos) columns.push('Photo');
    columns.push('Reg Number', 'Student Name', 'LIN', 'Class', 'Status', 'Fees Status', 'Parent Phone');

    // Prepare table data
    const tableData = students.map((student, index) => {
      const feesLabel = (student.fees_status || '').toLowerCase() === 'pending' ? 'Partially Paid' : (student.fees_status || '');
      const row: (string | number)[] = [
        index + 1
      ];
      if (header.includePhotos) {
        row.push(''); // Placeholder for photo
      }
      row.push(
        student.reg_number?.replace(/-/g, '') || '',
        student.student_name || '',
        student.lin || '-',
        student.class_name || '',
        student.student_status || '',
        feesLabel,
        student.parent_phone_sms || 'N/A'
      );
      return row;
    });

    // Column styles
    const colStyles: any = {
      0: { halign: 'left', cellWidth: 10, fillColor: [248, 249, 250] }, // #
    };
    let colIdx = 1;
    if (header.includePhotos) {
      colStyles[colIdx] = { cellWidth: 20, minCellHeight: 20, valign: 'middle' }; // Photo
      colIdx++;
    }
    colStyles[colIdx] = { halign: 'left', cellWidth: 30, fontStyle: 'bold', valign: 'middle' }; // Reg Number
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 'auto', fontStyle: 'normal', valign: 'middle' }; // Name
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 30, valign: 'middle' }; // LIN
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 22, valign: 'middle' }; // Class
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 26, valign: 'middle' }; // Status
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 30, valign: 'middle' }; // Fees Status
    colIdx++;
    colStyles[colIdx] = { halign: 'left', cellWidth: 35, valign: 'middle' }; // Phone

    // Indices for status coloring (Account for #, Photo?, Reg, Name, LIN, Class -> Status is next)
    // If Photos: # (0), Photo (1), Reg (2), Name (3), LIN (4), Class (5), Status (6), Fees (7)
    // No Photos: # (0), Reg (1), Name (2), LIN (3), Class (4), Status (5), Fees (6)
    const statusColIdx = header.includePhotos ? 6 : 5;
    const feesStatusColIdx = header.includePhotos ? 7 : 6;
    const photoColIdx = 1;

    // Table styling with vivid colors and professional design
    autoTable(doc, {
      startY: header.filterInfo ? metaY + 8 : metaY + 2,
      head: [columns],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 11,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        font: 'helvetica',
        textColor: [40, 40, 40],
        halign: 'left',
        overflow: 'linebreak' // Ensure text wraps
      },
      headStyles: {
        fillColor: [230, 230, 230], // #e6e6e6
        textColor: [0, 0, 0], // Black text
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      columnStyles: colStyles,
      alternateRowStyles: {
        fillColor: [245, 247, 250] // Light alternating rows for readability
      },
      // Vivid row highlighting based on status
      didDrawCell: (data) => {
        // Draw Photo
        if (header.includePhotos && data.column.index === photoColIdx && data.section === 'body') {
          const student = students[data.row.index];
          if (!student) return;
          const base64 = photoMap.get(student.student_id);
          if (base64) {
            try {
              // Center image in cell
              const cell = data.cell;
              const imgSize = 16;
              const x = cell.x + (cell.width - imgSize) / 2;
              const y = cell.y + (cell.height - imgSize) / 2;
              doc.addImage(base64, 'PNG', x, y, imgSize, imgSize);
            } catch (e) {
              console.error(`Failed to add image for student ${student.student_id} at row ${data.row.index}`, e);
            }
          } else {
            // Optional: Draw "No Photo" text or placeholder
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            const cell = data.cell;
            doc.text('No Photo', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' });
          }
        }
      },
      didParseCell: (data) => {
        // Color-code status columns (TEXT only, no background)
        if (data.column.index === statusColIdx && data.section === 'body') { // Student Status
          const status = (data.cell.raw as string || '').toLowerCase();
          let textColor: [number, number, number] = [0, 0, 0]; // Default Black

          if (status === 'active') {
            textColor = [0, 153, 51]; // Bright Green
          } else if (['inactive', 'expelled', 'suspended', 'sick'].includes(status)) {
            textColor = [220, 53, 69]; // Red
          } else if (status === 'alumni') {
            textColor = [25, 118, 210]; // Blue
          }

          data.cell.styles.textColor = textColor;
          if (status !== '') data.cell.styles.fontStyle = 'bold';
        }

        if (data.column.index === feesStatusColIdx && data.section === 'body') { // Fees Status
          const status = (data.cell.raw as string || '').toLowerCase();
          let textColor: [number, number, number] = [0, 0, 0]; // Default Black (empty)

          if (status === 'paid') {
            textColor = [0, 153, 51]; // Visible Bright Green
          } else if (status === 'pending' || status === 'partially paid') {
            textColor = [25, 118, 210]; // Blue
          } else if (status === 'defaulter') {
            textColor = [220, 38, 38]; // Red
          }

          if (status) {
            data.cell.styles.textColor = textColor;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
      tableWidth: pageWidth - 28 // Explicitly set width to page width minus margins
    });

    // ========== FOOTER SECTION ==========
    const finalY = (doc as any).lastAutoTable.finalY || 50;

    // Add summary box if there's space
    if (finalY < pageHeight - 30) {
      const summaryY = finalY + 8;

      // Summary box background
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(14, summaryY, pageWidth - 28, 15, 2, 2, 'FD');

      // Summary text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(52, 73, 94);

      const activeCount = students.filter(s => s.student_status?.toLowerCase() === 'active').length;
      const paidCount = students.filter(s => s.fees_status?.toLowerCase() === 'paid').length;
      const defaulterCount = students.filter(s => s.fees_status?.toLowerCase() === 'defaulter').length;

      doc.text(`Summary: ${activeCount} Active Students | ${paidCount} Paid | ${defaulterCount} Defaulters`,
        pageWidth / 2, summaryY + 6, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('This is an official computer-generated document.',
        pageWidth / 2, summaryY + 11, { align: 'center' });

      // Branding line
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Bigezo, a product of G-Realm Studio    --------- support@bigezo.com',
        pageWidth / 2, summaryY + 14, { align: 'center' });
    }

    // Page footer on every page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');

      // Footer line
      doc.setDrawColor(220, 220, 220);
      doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

      // Footer text - left
      doc.text(`${header.schoolName} - Student Registry`, 14, pageHeight - 5);

      // Footer text - center (branding)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Bigezo app, a product of G-Realm Studio    --------- support@bigezo.com', pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Footer text - right
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
    }

    // ========== SAVE PDF ==========
    const fileName = `Student_List_${header.year}_${header.term}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generates a professional Marks List PDF
   */
  async generateMarksListPDF(
    data: { reg: string; name: string; mark: number | string }[],
    header: {
      schoolName: string;
      className: string;
      subjectName: string;
      examSetName: string;
      elementName: string;
      generatedDate: string;
      badgeUrl?: string;
    }
  ): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ========== HEADER SECTION ==========
    // Background gradient effect
    doc.setFillColor(0, 89, 179); // #0059b3
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Accent stripe
    doc.setFillColor(255, 193, 7); // Gold accent
    doc.rect(0, 40, pageWidth, 2, 'F');

    let textStartX = pageWidth / 2;
    let align: 'center' | 'left' | 'right' = 'center';

    // Badge Logic
    if (header.badgeUrl) {
      try {
        const badgeData = await this.getBase64ImageFromURL(header.badgeUrl);
        // Calculate dimensions
        const dims = await new Promise<{ w: number, h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 30, h: 30 });
          img.src = badgeData;
        });

        const maxW = 30;
        const maxH = 30;
        let w = maxW;
        let h = maxH;

        if (dims.w > 0 && dims.h > 0) {
          const aspect = dims.w / dims.h;
          if (aspect > 1) { h = maxW / aspect; } else { w = maxH * aspect; }
        }

        const x = 14 + (maxW - w) / 2;
        const y = 5 + (maxH - h) / 2;

        try {
          const normalizedData = await this.normalizeImage(badgeData);
          doc.addImage(normalizedData, 'PNG', x, y, w, h);
        } catch (normErr) {
          // Fallback
          const rawBase64 = badgeData.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
          doc.addImage(rawBase64, 'PNG', x, y, w, h);
        }

        textStartX = 55;
        align = 'left';
      } catch (err) {
        console.warn('Failed to load badge image for PDF', err);
      }
    }

    // School Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(header.schoolName, textStartX, 15, { align: align });

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Marks List', textStartX, 24, { align: align });

    // Context Info (Class, Subject, etc.)
    doc.setFontSize(10);
    doc.setTextColor(220, 220, 220);
    const infoY = 32;
    // If badge is present, list info on the right, otherwise center/spread
    if (header.badgeUrl) {
      doc.text(`${header.className} | ${header.subjectName}`, textStartX, infoY);
      doc.text(`${header.examSetName} - ${header.elementName}`, textStartX, infoY + 5);
    } else {
      doc.text(`${header.className} | ${header.subjectName} | ${header.examSetName}`, pageWidth / 2, infoY, { align: 'center' });
      doc.text(header.elementName, pageWidth / 2, infoY + 5, { align: 'center' });
    }

    // ========== METADATA ==========
    doc.setTextColor(0, 0, 0);
    const metaY = 48;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${header.generatedDate}`, 14, metaY);
    doc.text(`Total Students: ${data.length}`, pageWidth - 14, metaY, { align: 'right' });

    // ========== TABLE ==========
    const tableData = data.map((item, i) => {
      return [
        i + 1,
        item.reg,
        item.name,
        item.mark === null || item.mark === undefined || item.mark === '' ? 'MISSING' : item.mark
      ];
    });

    autoTable(doc, {
      startY: metaY + 5,
      head: [['#', 'Reg Number', 'Student Name', 'Mark Obtained']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 11,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        font: 'helvetica',
        textColor: [40, 40, 40]
      },
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fillColor: [245, 245, 245] },
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw;
          if (val === 'MISSING') {
            data.cell.styles.textColor = [192, 57, 43]; // Red
            data.cell.styles.fillColor = [253, 237, 236];
          } else {
            data.cell.styles.textColor = [25, 111, 61]; // Green
          }
        }
      }
    });

    // ========== FOOTER ==========
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
      doc.text('Bigezo app, a product of G-Realm Studio', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    const fileName = `Marks_${header.className}_${header.elementName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    doc.save(fileName);
  }
  private async getBase64ImageFromURL(url: string): Promise<string> {
    try {
      // Use backend proxy to avoid CORS issues
      const proxyUrl = `/api/v1/utils/proxy-image?url=${encodeURIComponent(url)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Proxy fetch failed: ${response.statusText}`);
      }
      const blob = await response.blob();
      console.log('Image Blob Type:', blob.type, 'Size:', blob.size);
      if (blob.type.startsWith('text/') || blob.type.includes('html')) {
        const text = await blob.text();
        console.error('Proxy returned HTML/Text instead of image. Content:', text.substring(0, 500)); // Log first 500 chars
        throw new Error(`Fetched resource is not an image. Type: ${blob.type}`);
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching badge image via proxy:', error);
      // Fallback to direct fetch
      try {
        const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
        const response = await fetch(fetchUrl);
        const blob = await response.blob();
        if (blob.type.startsWith('text/') || blob.type.includes('html')) {
          throw new Error(`Fetched resource is not an image. Type: ${blob.type}`);
        }
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Direct fetch also failed', e);
        throw e;
      }
    }
  }

  /**
   * Normalizes an image to a valid PNG base64 string using an HTML Canvas.
   * This ensures that the image data is always a valid PNG, preventing "wrong PNG signature" errors.
   */
  private normalizeImage(base64Data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // No crossOrigin needed for base64 data URIs

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            // Convert to PNG data URL
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = (e) => {
        reject(new Error('Failed to load image for normalization'));
      };

      img.src = base64Data;
    });
  }

  private detectImageFormat(base64Data: string): 'PNG' | 'JPEG' | 'UNKNOWN' {
    // Check for PNG signature (iVBORw0KGgo)
    if (base64Data.startsWith('iVBORw0KGgo')) {
      return 'PNG';
    }
    // Check for JPEG signature (/9j/)
    if (base64Data.startsWith('/9j/')) {
      return 'JPEG';
    }
    return 'UNKNOWN';
  }
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }
}
