import { useState, useEffect } from 'react';
import { Download, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchInventory, createProduct, updateProduct, deleteProduct, fetchSalesReport } from '../api';

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('daily');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [stockExportFormat, setStockExportFormat] = useState('xlsx');
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price: '', quantity: '', entry_date: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) {
      console.error("Error loading inventory", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        name: newProduct.name,
        barcode: newProduct.barcode || null,
        price: parseFloat(newProduct.price),
        quantity: parseInt(newProduct.quantity),
        entry_date: newProduct.entry_date || new Date().toISOString().split('T')[0]
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        setSuccess('Producto actualizado exitosamente');
      } else {
        await createProduct(productData);
        setSuccess('Producto agregado exitosamente');
      }

      setIsModalOpen(false);
      setNewProduct({ name: '', barcode: '', price: '', quantity: '', entry_date: '' });
      setEditingProduct(null);
      loadData();
    } catch (err) {
      console.error("Error saving product", err);
      setError("Hubo un error al guardar el producto");
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      barcode: product.barcode || '',
      price: product.price,
      quantity: product.quantity,
      entry_date: product.entry_date || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      await deleteProduct(id);
      setSuccess('Producto eliminado exitosamente');
      loadData();
    } catch (err) {
      console.error("Error deleting product", err);
      setError("Hubo un error al eliminar el producto");
    }
  };

  const handleExportConfirm = async () => {
    try {
      const report = await fetchSalesReport();
      
      if (report.length === 0) {
        alert("No hay datos para exportar");
        return;
      }

      const sortedReport = [...report].sort((a, b) => a.id - b.id);
      
      let exportData;
      let baseFilename;

      if (exportPeriod === 'daily') {
          exportData = sortedReport.map(item => ({
              'Producto': item.name || '',
              'Stock Actual': item.quantity,
              'Precio Unitario ($)': item.price,
              'Vendidos Hoy': item.sales_today,
              'Monto Vendido ($)': item.revenue_today
          }));
          baseFilename = 'ventas_por_dia';
      } else if (exportPeriod === 'weekly') {
          exportData = sortedReport.map(item => ({
              'Producto': item.name || '',
              'Stock Actual': item.quantity,
              'Precio Unitario ($)': item.price,
              'Vendidos Semana': item.sales_week,
              'Total Ventas ($)': item.revenue_week
          }));
          baseFilename = 'ventas_por_semana';
      } else if (exportPeriod === 'monthly') {
          exportData = sortedReport.map(item => ({
              'Producto': item.name || '',
              'Stock Actual': item.quantity,
              'Precio Unitario ($)': item.price,
              'Vendidos Mes': item.sales_month,
              'Total Ventas ($)': item.revenue_month
          }));
          baseFilename = 'ventas_por_mes';
      }

      // Calculate total amount
      const totalAmount = exportData.reduce((sum, item) => {
          const val = item['Monto Vendido ($)'] || item['Total Ventas ($)'] || 0;
          return sum + val;
      }, 0);

      // Append summary row
      const summaryRow = {
          'Producto': '',
          'Stock Actual': '',
          'Precio Unitario ($)': ''
      };
      
      if (exportPeriod === 'daily') {
          summaryRow['Vendidos Hoy'] = 'TOTAL GENERAL:';
          summaryRow['Monto Vendido ($)'] = totalAmount;
      } else if (exportPeriod === 'weekly') {
          summaryRow['Vendidos Semana'] = 'TOTAL GENERAL:';
          summaryRow['Total Ventas ($)'] = totalAmount;
      } else {
          summaryRow['Vendidos Mes'] = 'TOTAL GENERAL:';
          summaryRow['Total Ventas ($)'] = totalAmount;
      }
      exportData.push(summaryRow);

      const filename = `${baseFilename}.${exportFormat}`;

      if (exportFormat === 'xlsx') {
          const workbook = XLSX.utils.book_new();
          
          const periodText = exportPeriod === 'daily' ? 'Diario' : exportPeriod === 'weekly' ? 'Semanal' : 'Mensual';
          const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

          const aoa = [
            ['🌶️ LA CHILUDA EN PAPAS'], 
            ['Reporte de Ventas: ' + periodText],
            ['Fecha de Emisión: ' + dateStr],
            [], 
            Object.keys(exportData[0]) 
          ];
          
          exportData.forEach(obj => {
             aoa.push(Object.values(obj));
          });

          const worksheet = XLSX.utils.aoa_to_sheet(aoa);
          
          worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
          ];

          // Aplicar estilos de diseño
          worksheet['A1'].s = {
              font: { bold: true, sz: 16, color: { rgb: "FFEF4444" } }, // Rojo Chiluda
              alignment: { horizontal: "center", vertical: "center" }
          };
          worksheet['A2'].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center" } };
          worksheet['A3'].s = { font: { italic: true, sz: 10, color: { rgb: "FF6B7280" } }, alignment: { horizontal: "center" } };

          // Estilizar encabezados (Fila 4)
          const range = XLSX.utils.decode_range(worksheet['!ref']);
          for (let c = range.s.c; c <= range.e.c; ++c) {
              const cellRef = XLSX.utils.encode_cell({ c: c, r: 4 });
              if (!worksheet[cellRef]) continue;
              worksheet[cellRef].s = {
                  fill: { fgColor: { rgb: "FFEF4444" } }, // Rojo fondo
                  font: { bold: true, color: { rgb: "FFFFFFFF" } }, // Blanco texto
                  alignment: { horizontal: "center", vertical: "center" },
                  border: { top: { style: "thin" }, bottom: { style: "medium" } }
              };
          }

          // Bordes y estilo a datos
          for (let r = 5; r <= range.e.r; ++r) {
              for (let c = range.s.c; c <= range.e.c; ++c) {
                  const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
                  if (!worksheet[cellRef]) continue;
                  
                  if (r === range.e.r) {
                      // Estilo para la última fila (Total General)
                      worksheet[cellRef].s = {
                          font: { bold: true, color: { rgb: "FF991B1B" } }, // Red-800
                          fill: { fgColor: { rgb: "FFFEE2E2" } }, // Red-50
                          border: { top: { style: "medium" }, bottom: { style: "medium" } }
                      };
                  } else {
                      worksheet[cellRef].s = {
                          border: { bottom: { style: "dotted", color: { rgb: "FFCCCCCC" } } }
                      };
                      if (r % 2 === 0) worksheet[cellRef].s.fill = { fgColor: { rgb: "FFF9FAFB" } };
                  }
              }
          }

          worksheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];

          XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
          XLSX.writeFile(workbook, filename);
      } else if (exportFormat === 'json') {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode); 
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (exportFormat === 'csv') {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
          const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvOutput);
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (exportFormat === 'txt') {
          const headers = Object.keys(exportData[0]).join('|');
          const rows = exportData.map(obj => Object.values(obj).join('|')).join('\n');
          const txtOutput = headers + '\n' + rows;
          const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(txtOutput);
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (exportFormat === 'xml') {
          let xmlOutput = '<?xml version="1.0" encoding="UTF-8"?>\n<reporte>\n';
          exportData.forEach(item => {
              xmlOutput += '  <item>\n';
              for (const [key, value] of Object.entries(item)) {
                  const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'dato';
                  xmlOutput += `    <${safeKey}>${value}</${safeKey}>\n`;
              }
              xmlOutput += '  </item>\n';
          });
          xmlOutput += '</reporte>';
          const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(xmlOutput);
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (exportFormat === 'pdf') {
          const doc = new jsPDF();
          
          // Generar un logo de forma programática usando Canvas para embeberlo en el PDF
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 80;
          const ctx = canvas.getContext('2d');
          
          // Icono de chile
          ctx.font = '40px Arial';
          ctx.fillText('🌶️', 10, 52);

          // Texto de la empresa
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 32px Arial';
          ctx.fillText('LA CHILUDA', 70, 40);
          
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 16px Arial';
          ctx.fillText('EN PAPAS', 70, 62);

          const logoData = canvas.toDataURL('image/png');
          
          // Insertar logo
          doc.addImage(logoData, 'PNG', 14, 10, 75, 20);
          
          // Título y Fecha
          doc.setFontSize(22);
          doc.setTextColor(31, 41, 55);
          doc.text('Reporte de Ventas', 14, 45);
          
          const periodText = exportPeriod === 'daily' ? 'Diario' : exportPeriod === 'weekly' ? 'Semanal' : 'Mensual';
          const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
          
          doc.setFontSize(11);
          doc.setTextColor(107, 114, 128);
          doc.text(`Período: ${periodText}   |   Fecha de Emisión: ${dateStr}`, 14, 53);
          
          // Línea separadora
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.5);
          doc.line(14, 58, 196, 58);

          // Tabla de datos
          const head = [Object.keys(exportData[0])];
          const body = exportData.map(obj => Object.values(obj));
          
          autoTable(doc, {
              head: head,
              body: body,
              startY: 65,
              theme: 'grid',
              headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [254, 242, 242] },
              styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 },
              didParseCell: function (data) {
                  if (data.section === 'body' && data.row.index === body.length - 1) {
                      data.cell.styles.fontStyle = 'bold';
                      data.cell.styles.textColor = [153, 27, 27]; // Red-800
                      data.cell.styles.fillColor = [254, 226, 226]; // Red-50
                  }
              }
          });
          
          doc.save(filename);
      }
      
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Error generating export", error);
      alert("Hubo un error al generar el reporte");
    }
  };

  const handleExportStockConfirm = async () => {
    try {
      if (inventory.length === 0) {
        alert("No hay productos en el inventario");
        return;
      }
      
      const exportData = inventory.map(item => ({
          'ID': item.id,
          'Producto': item.name || '',
          'Precio ($)': item.price,
          'Stock Actual': item.quantity,
          'Fecha Ingreso': item.entry_date || 'N/A'
      }));
      
      const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      const filename = `inventario_actual.${stockExportFormat}`;

      if (stockExportFormat === 'xlsx') {
          const workbook = XLSX.utils.book_new();
          const aoa = [
            ['🌶️ LA CHILUDA EN PAPAS'], 
            ['Reporte de Inventario Actual'],
            ['Fecha de Emisión: ' + dateStr],
            [], 
            Object.keys(exportData[0]) 
          ];
          
          exportData.forEach(obj => {
             aoa.push(Object.values(obj));
          });

          const worksheet = XLSX.utils.aoa_to_sheet(aoa);
          
          worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
          ];

          worksheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: "FFEF4444" } }, alignment: { horizontal: "center", vertical: "center" } };
          worksheet['A2'].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center" } };
          worksheet['A3'].s = { font: { italic: true, sz: 10, color: { rgb: "FF6B7280" } }, alignment: { horizontal: "center" } };

          const range = XLSX.utils.decode_range(worksheet['!ref']);
          for (let c = range.s.c; c <= range.e.c; ++c) {
              const cellRef = XLSX.utils.encode_cell({ c: c, r: 4 });
              if (!worksheet[cellRef]) continue;
              worksheet[cellRef].s = {
                  fill: { fgColor: { rgb: "FFEF4444" } }, 
                  font: { bold: true, color: { rgb: "FFFFFFFF" } },
                  alignment: { horizontal: "center", vertical: "center" },
                  border: { top: { style: "thin" }, bottom: { style: "medium" } }
              };
          }

          for (let r = 5; r <= range.e.r; ++r) {
              for (let c = range.s.c; c <= range.e.c; ++c) {
                  const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
                  if (!worksheet[cellRef]) continue;
                  worksheet[cellRef].s = { border: { bottom: { style: "dotted", color: { rgb: "FFCCCCCC" } } } };
                  if (r % 2 === 0) worksheet[cellRef].s.fill = { fgColor: { rgb: "FFF9FAFB" } };
              }
          }

          worksheet['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
          XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
          XLSX.writeFile(workbook, filename);
          
      } else if (stockExportFormat === 'pdf') {
          const doc = new jsPDF();
          const canvas = document.createElement('canvas');
          canvas.width = 300; canvas.height = 80;
          const ctx = canvas.getContext('2d');
          ctx.font = '40px Arial'; ctx.fillText('🌶️', 10, 52);
          ctx.fillStyle = '#1f2937'; ctx.font = 'bold 32px Arial'; ctx.fillText('LA CHILUDA', 70, 40);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 16px Arial'; ctx.fillText('EN PAPAS', 70, 62);
          const logoData = canvas.toDataURL('image/png');
          
          doc.addImage(logoData, 'PNG', 14, 10, 75, 20);
          doc.setFontSize(22); doc.setTextColor(31, 41, 55); doc.text('Inventario Actual', 14, 45);
          doc.setFontSize(11); doc.setTextColor(107, 114, 128); doc.text(`Fecha de Emisión: ${dateStr}`, 14, 53);
          
          doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.5); doc.line(14, 58, 196, 58);

          const head = [Object.keys(exportData[0])];
          const body = exportData.map(obj => Object.values(obj));
          
          autoTable(doc, {
              head: head, body: body, startY: 65, theme: 'grid',
              headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [254, 242, 242] },
              styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 }
          });
          doc.save(filename);
      } else if (stockExportFormat === 'sql') {
          let sqlOutput = "-- Reporte de Inventario La Chiluda\n";
          sqlOutput += `-- Fecha de Emisión: ${dateStr}\n\n`;
          sqlOutput += "CREATE TABLE IF NOT EXISTS products (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(255),\n  price DECIMAL(10,2),\n  quantity INTEGER\n);\n\n";
          
          inventory.forEach(item => {
             const safeName = (item.name || '').replace(/'/g, "''");
             sqlOutput += `INSERT INTO products (id, name, price, quantity) VALUES (${item.id}, '${safeName}', ${item.price}, ${item.quantity});\n`;
          });
          
          const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(sqlOutput);
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      }
      setIsStockModalOpen(false);
    } catch(err) {
       console.error("Error generating stock export", err);
       alert("Hubo un error al generar el inventario");
    }
  };

  const filteredInventory = inventory.filter(item => {
    const productName = item?.name || '';
    return productName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-3xl font-extrabold text-brand-900 tracking-tight animate-fade-in">Gestión de Inventario</h2>

        <div className="flex flex-wrap gap-3 items-center animate-fade-in w-full md:w-auto">
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="flex items-center space-x-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-700 px-5 py-2.5 rounded-full hover:bg-brand-50 hover:text-chiluda-red hover:border-chiluda-red/30 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Download size={18} />
            <span className="font-semibold text-sm">Exportar Stock</span>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-700 px-5 py-2.5 rounded-full hover:bg-brand-50 hover:text-chiluda-red hover:border-chiluda-red/30 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Download size={18} />
            <span className="font-semibold text-sm">Exportar Ventas</span>
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setNewProduct({ name: '', barcode: '', price: '', quantity: '', entry_date: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:scale-105 active:scale-95 transition-all duration-300 shadow-float"
          >
            <Plus size={18} />
            <span className="font-bold text-sm">Nuevo Producto</span>
          </button>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded-lg border border-green-200">{success}</div>}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar producto?</h3>
              <p className="text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors w-full font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirm)}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors w-full font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-soft border border-white overflow-hidden animate-slide-up">
        {/* Toolbar */}
        <div className="p-4 md:p-6 border-b border-gray-100/50 flex flex-col md:flex-row items-start md:items-center justify-between bg-white/40 gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="w-full pl-11 pr-4 py-2.5 bg-brand-50/50 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-chiluda-red focus:border-transparent focus:bg-white transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold rounded-tl-xl">Producto</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-right">Precio</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-center">Stock</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 font-bold text-center">Ingreso</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 font-bold text-center">Vendidos</th>
                <th className="hidden lg:table-cell px-3 md:px-6 py-3 md:py-4 font-bold text-center">Faltan</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-center rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                  <td className="px-3 md:px-6 py-3 md:py-4 max-w-[120px] md:max-w-none truncate">
                    <span className="font-medium text-gray-800 block truncate">{item.name}</span>
                    {item.barcode && <span className="text-[10px] md:text-xs text-gray-400 mt-1 block truncate">Cód: {item.barcode}</span>}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-right text-gray-600 text-sm md:text-base">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${item.quantity < 20 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                      {item.quantity} u.
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-center text-gray-600 text-sm md:text-base">
                    {item.entry_date || '-'}
                  </td>
                  <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-center text-gray-600 text-sm md:text-base">
                    {item.sold} u.
                  </td>
                  <td className="hidden lg:table-cell px-3 md:px-6 py-3 md:py-4 text-center">
                    <span className="text-gray-500 text-sm">
                      {Math.max(0, 50 - item.quantity)} u.
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4">
                    <div className="flex items-center justify-center space-x-2 md:space-x-3">
                      <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo/Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingProduct ? 'Modificar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Ej. Papas Fuego"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras (Opcional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red"
                  value={newProduct.barcode}
                  onChange={(e) => {
                    const val = e.target.value;
                    const existing = inventory.find(p => p.barcode && p.barcode === val);
                    
                    if (existing) {
                      setEditingProduct(existing);
                      setNewProduct({
                        name: existing.name,
                        barcode: existing.barcode,
                        price: existing.price,
                        quantity: '',
                        entry_date: existing.entry_date || ''
                      });
                    } else {
                      setNewProduct({ ...newProduct, barcode: val });
                    }
                  }}
                  placeholder="Escanea o escribe el código"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red"
                  value={newProduct.entry_date}
                  onChange={(e) => setNewProduct({ ...newProduct, entry_date: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Si se deja vacío, se asignará la fecha de hoy automáticamente.</p>
              </div>
              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors"
                >
                  {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Exportar */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Reportes</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periodo del Reporte</label>
                <div className="grid grid-cols-3 gap-3">
                  {['daily', 'weekly', 'monthly'].map(p => (
                    <button
                      key={p}
                      onClick={() => setExportPeriod(p)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        exportPeriod === p 
                        ? 'bg-red-50 border-chiluda-red text-chiluda-red' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p === 'daily' ? 'Día' : p === 'weekly' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Archivo</label>
                <div className="grid grid-cols-3 gap-3">
                  {['xlsx', 'csv', 'txt', 'json', 'xml', 'pdf'].map(f => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium uppercase transition-colors ${
                        exportFormat === f 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportConfirm}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors flex items-center space-x-2"
                >
                  <Download size={18} />
                  <span>Descargar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Exportar Stock */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Inventario Actual</h3>
              <button onClick={() => setIsStockModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Archivo</label>
                <div className="grid grid-cols-3 gap-3">
                  {['xlsx', 'pdf', 'sql'].map(f => (
                    <button
                      key={f}
                      onClick={() => setStockExportFormat(f)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium uppercase transition-colors ${
                        stockExportFormat === f 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportStockConfirm}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors flex items-center space-x-2"
                >
                  <Download size={18} />
                  <span>Descargar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
