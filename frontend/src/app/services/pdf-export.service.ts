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
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  constructor() { }

  generateFeesDetailsPDF(rows: Array<{ reg: string; name: string; klass: string; feesStatus: string; feeName?: string; term?: number; year?: number; total?: number; paid?: number; balance?: number; phone: string }>, header: PDFHeader): void {
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
      '#','Reg Number','Student Name','Class','Fees Status','Fee',
      ...(includeTerm ? ['Term'] : []),
      ...(includeYear ? ['Year'] : []),
      'Total Due','Paid','Balance','Parent Phone'
    ]];
    const fmt0 = (n: any) => {
      const v = Number(n || 0);
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };
    const body = rows.map((r, i) => {
      const base: any[] = [
        i + 1,
        r.reg,
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
      styles: { fontSize: 11, cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.25, font: 'helvetica', textColor: [40,40,40], halign: 'left' },
      headStyles: { fillColor: [52,73,94], textColor: [255,255,255], fontSize: 12, fontStyle: 'bold', halign: 'left', cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 8 }, // #
        1: { cellWidth: 28 }, // Reg
        2: { cellWidth: 48 }, // Name
        3: { cellWidth: 20 }, // Class
        4: { cellWidth: 24 }, // Status
        5: { cellWidth: 30 }, // Fee
        6: { cellWidth: includeTerm ? 14 : (includeYear ? 20 : 24) }, // Term or Total Due depending on shifts
      },
      alternateRowStyles: { fillColor: [245,247,250] },
      didParseCell: (data) => {
        if (data.column.index === 9 && data.section === 'body') {
          // Balance color: red if > 0 else green
          const raw = (data.cell.raw as string) || '0';
          const numeric = Number(String(raw).replace(/[^0-9.-]/g, '')) || 0;
          data.cell.styles.textColor = numeric > 0 ? [198, 40, 40] : [46, 125, 50];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && data.section === 'body') {
          const status = (data.cell.raw as string || '').toLowerCase();
          let bg: [number,number,number] = [255,255,255]; let tx: [number,number,number] = [40,40,40];
          if (status === 'paid') { bg = [198,246,213]; tx = [22,163,74]; }
          if (status === 'pending' || status === 'partially paid') { bg = [227,242,253]; tx = [25,118,210]; }
          if (status === 'defaulter') { bg = [254,202,202]; tx = [220,38,38]; }
          data.cell.styles.fillColor = bg; data.cell.styles.textColor = tx; data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto'
    });

    const fileName = `Fees_Details_${header.year}_${header.term}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generates a professional PDF with student data
   * Designed with Adobe-quality styling
   */
  generateStudentListPDF(students: Student[], header: PDFHeader): void {
    // Create PDF in landscape for better table visibility
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ========== HEADER SECTION (Professional Adobe-style) ==========
    
    // Background gradient effect (simulated with filled rectangles)
    doc.setFillColor(0, 89, 179); // #0059b3
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Accent stripe
    doc.setFillColor(255, 193, 7); // Gold accent
    doc.rect(0, 35, pageWidth, 2, 'F');

    // School Name - Large, Bold, White
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(header.schoolName, pageWidth / 2, 12, { align: 'center' });

    // Document Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Registry Report', pageWidth / 2, 21, { align: 'center' });

    // Header Info Bar - Two columns
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const leftX = 14;
    const rightX = pageWidth - 14;
    
    // Left side info
    doc.setTextColor(255, 255, 255);
    doc.text(`Academic Year: ${header.year}`, leftX, 29);
    
    // Right side info
    const termText2 = (() => { const t = String(header.term || ''); return /^\s*term\b/i.test(t) ? t : (t ? `Term ${t}` : ''); })();
    if (termText2) doc.text(termText2, rightX, 29, { align: 'right' });

    // Reset text color for body
    doc.setTextColor(0, 0, 0);

    // ========== METADATA SECTION ==========
    const metaY = 42;
    
    // Left side - Generated date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${header.generatedDate}`, leftX, metaY);
    
    // Right side - Total Students (more vivid and larger)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 89, 179); // Blue color to match header
    doc.text(`Total Records: ${header.totalStudents}`, rightX, metaY, { align: 'right' });
    
    if (header.filterInfo) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Filters Applied: ${header.filterInfo}`, pageWidth / 2, metaY + 4, { align: 'center' });
    }

    // ========== TABLE SECTION (Adobe-quality styling) ==========
    
    // Prepare table data
    const tableData = students.map((student, index) => {
      // Debug: log if parent_phone_sms is missing
      if (!student.parent_phone_sms) {
        console.warn('Missing parent_phone_sms for student:', student.student_name, student);
      }
      
      const feesLabel = (student.fees_status || '').toLowerCase() === 'pending' ? 'Partially Paid' : (student.fees_status || '');
      return [
        index + 1,
        student.reg_number?.replace(/-/g, '') || '',
        student.student_name || '',
        student.class_name || '',
        student.student_status || '',
        feesLabel,
        student.parent_phone_sms || 'N/A'
      ];
    });

    // Table styling with vivid colors and professional design
    autoTable(doc, {
      startY: header.filterInfo ? metaY + 8 : metaY + 2,
      head: [['#', 'Reg Number', 'Student Name', 'Class', 'Status', 'Fees Status', 'Parent Phone']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 11,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        font: 'helvetica',
        textColor: [40, 40, 40],
        halign: 'left'
      },
      headStyles: {
        fillColor: [52, 73, 94], // Professional dark blue-gray
        textColor: [255, 255, 255],
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 10, fillColor: [248, 249, 250] }, // #
        1: { halign: 'left', cellWidth: 35, fontStyle: 'bold' }, // Reg Number
        2: { halign: 'left', cellWidth: 52, fontStyle: 'normal' }, // Student Name
        3: { halign: 'left', cellWidth: 22 }, // Class
        4: { halign: 'left', cellWidth: 26 }, // Status
        5: { halign: 'left', cellWidth: 35 }, // Fees Status - wider to prevent wrapping
        6: { halign: 'left', cellWidth: 40 } // Parent Phone
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250] // Light alternating rows for readability
      },
      // Vivid row highlighting based on status
      didParseCell: (data) => {
        // Color-code status columns
        if (data.column.index === 4 && data.section === 'body') { // Student Status
          const status = data.cell.raw as string;
          let bgColor: [number, number, number] = [255, 255, 255];
          let textColor: [number, number, number] = [40, 40, 40];
          
          switch (status?.toLowerCase()) {
            case 'active':
              bgColor = [212, 237, 218]; // Light green
              textColor = [25, 135, 84];
              break;
            case 'inactive':
              bgColor = [248, 215, 218]; // Light red
              textColor = [220, 53, 69];
              break;
            case 'suspended':
              bgColor = [255, 243, 205]; // Light orange
              textColor = [255, 140, 0];
              break;
            case 'expelled':
              bgColor = [240, 128, 128]; // Darker red
              textColor = [139, 0, 0];
              break;
            case 'alumni':
              bgColor = [209, 231, 221]; // Light teal
              textColor = [32, 201, 151];
              break;
            case 'sick':
              bgColor = [255, 229, 204]; // Light peach
              textColor = [255, 102, 0];
              break;
          }
          
          data.cell.styles.fillColor = bgColor;
          data.cell.styles.textColor = textColor;
          data.cell.styles.fontStyle = 'bold';
        }
        
        if (data.column.index === 5 && data.section === 'body') { // Fees Status
          const status = data.cell.raw as string;
          let bgColor: [number, number, number] = [255, 255, 255];
          let textColor: [number, number, number] = [40, 40, 40];
          
          switch (status?.toLowerCase()) {
            case 'paid':
              bgColor = [198, 246, 213]; // Green tint
              textColor = [22, 163, 74];
              break;
            case 'pending':
            case 'partially paid':
              bgColor = [227, 242, 253]; // Light blue
              textColor = [25, 118, 210]; // Brand blue
              break;
            case 'defaulter':
              bgColor = [254, 202, 202]; // Vivid red
              textColor = [220, 38, 38];
              break;
          }
          
          data.cell.styles.fillColor = bgColor;
          data.cell.styles.textColor = textColor;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto'
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
}
