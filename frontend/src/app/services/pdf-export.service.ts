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
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  constructor() { }

  generateFeesDetailsPDF(rows: Array<{ reg: string; name: string; klass: string; feesStatus: string; term?: number; year?: number; total?: number; paid?: number; balance?: number; phone: string }>, header: PDFHeader): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header (reuse style)
    doc.setFillColor(0, 89, 179);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFillColor(255, 193, 7);
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
    doc.text(`Term: ${header.term}`, rightX, 29, { align: 'right' });

    // Meta
    doc.setTextColor(0, 0, 0);
    const metaY = 42;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${header.generatedDate}`, leftX, metaY);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 89, 179);
doc.text(`Total Students: ${header.totalStudents}`, rightX, metaY, { align: 'right' });
    if (header.filterInfo) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Filters Applied: ${header.filterInfo}`, pageWidth / 2, metaY + 4, { align: 'center' });
    }

    // Table
    const head = [['#', 'Reg Number', 'Student Name', 'Class', 'Fees Status', 'Term', 'Year', 'Total Due', 'Paid', 'Balance', 'Parent Phone']];
    const body = rows.map((r, i) => [i + 1, r.reg, r.name, r.klass, (r.feesStatus || '').toLowerCase() === 'pending' ? 'Partially Paid' : (r.feesStatus || ''), r.term ?? '', r.year ?? '', r.total ?? '', r.paid ?? '', r.balance ?? '', r.phone]);

    autoTable(doc, {
      startY: header.filterInfo ? metaY + 8 : metaY + 2,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.25, font: 'helvetica', textColor: [40,40,40], halign: 'left' },
      headStyles: { fillColor: [52,73,94], textColor: [255,255,255], fontSize: 12, fontStyle: 'bold', halign: 'left', cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 48 }, 3: { cellWidth: 20 }, 4: { cellWidth: 24 },
        5: { cellWidth: 12 }, 6: { cellWidth: 16 }, 7: { cellWidth: 22 }, 8: { cellWidth: 18 }, 9: { cellWidth: 22 }, 10: { cellWidth: 28 }
      },
      alternateRowStyles: { fillColor: [245,247,250] },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const status = (data.cell.raw as string || '').toLowerCase();
          let bg: [number,number,number] = [255,255,255]; let tx: [number,number,number] = [40,40,40];
          if (status === 'paid') { bg = [198,246,213]; tx = [22,163,74]; }
          if (status === 'pending') { bg = [254,243,199]; tx = [202,138,4]; }
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
    doc.text(`Term: ${header.term}`, rightX, 29, { align: 'right' });

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
    doc.text(`Total Students: ${header.totalStudents}`, rightX, metaY, { align: 'right' });
    
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
              bgColor = [198, 246, 213]; // Vivid green
              textColor = [22, 163, 74];
              break;
            case 'pending':
            case 'partially paid':
              bgColor = [254, 243, 199]; // Vivid yellow
              textColor = [202, 138, 4];
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
      doc.text('Bigezolite, a product of G-Realm Studio', 
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
      doc.text('Bigezolite app, a product of G-Realm Studio', pageWidth / 2, pageHeight - 5, { align: 'center' });
      
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
