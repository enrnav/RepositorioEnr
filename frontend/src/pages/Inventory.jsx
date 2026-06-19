import { useState, useEffect } from 'react';
import { Download, Plus, Search, Edit2, Trash2, X, Package } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchInventory, createProduct, updateProduct, deleteProduct, fetchSalesReport, fetchReturnsReport, searchProductImage } from '../api';



const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('daily');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [stockExportFormat, setStockExportFormat] = useState('xlsx');
  const [isReturnsExportModalOpen, setIsReturnsExportModalOpen] = useState(false);
  const [returnsExportFormat, setReturnsExportFormat] = useState('xlsx');
  const [returnsExportPeriod, setReturnsExportPeriod] = useState('all');
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price: '', cost_price: '0', quantity: '', min_stock: '3', entry_date: '', image: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [productVariants, setProductVariants] = useState([]);
  const [newVariant, setNewVariant] = useState({ name: '', barcode: '', cost_price: '', price: '', quantity: '0' });
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

  // Debounced auto-search for product image when name is typed
  useEffect(() => {
    if (!newProduct.name || newProduct.name.trim().length < 3) return;
    if (newProduct.image && newProduct.image.trim() !== '') return;

    const delayDebounceFn = setTimeout(() => {
      if (!newProduct.image || newProduct.image.trim() === '') {
        handleAutoSearchImage(newProduct.name);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [newProduct.name]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen es demasiado grande. El límite es de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoSearchImage = async (name) => {
    if (!name || !name.trim()) return;
    setIsSearchingImage(true);
    try {
      const data = await searchProductImage(name.trim());
      if (data && data.image_url) {
        setNewProduct(prev => ({ ...prev, image: data.image_url }));
      }
    } catch (err) {
      console.error("Failed to auto-search product image:", err);
    } finally {
      setIsSearchingImage(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        name: newProduct.name,
        barcode: newProduct.barcode || null,
        price: parseFloat(newProduct.price),
        cost_price: parseFloat(newProduct.cost_price) || 0.0,
        quantity: parseInt(newProduct.quantity),
        min_stock: parseInt(newProduct.min_stock) || 3,
        entry_date: newProduct.entry_date || new Date().toISOString().split('T')[0],
        image: newProduct.image || null,
        variants: productVariants.map(v => ({
          name: v.name,
          barcode: v.barcode || null,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
          price: v.price ? parseFloat(v.price) : null,
          quantity: parseInt(v.quantity) || 0
        }))
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        setSuccess('Producto actualizado exitosamente');
      } else {
        await createProduct(productData);
        setSuccess('Producto agregado exitosamente');
      }

      setIsModalOpen(false);
      setNewProduct({ name: '', barcode: '', price: '', cost_price: '0', quantity: '', min_stock: '3', entry_date: '', image: '' });
      setProductVariants([]);
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
      cost_price: product.cost_price || 0,
      quantity: product.quantity,
      min_stock: product.min_stock || 3,
      entry_date: product.entry_date || '',
      image: product.image || ''
    });
    setProductVariants(product.variants || []);
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
            ['ABARROTES ED & E'], 
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
              font: { bold: true, sz: 16, color: { rgb: "FFEF4444" } }, 
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
                  fill: { fgColor: { rgb: "FFEF4444" } }, 
                  font: { bold: true, color: { rgb: "FFFFFFFF" } }, 
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
                          font: { bold: true, color: { rgb: "FF991B1B" } }, 
                          fill: { fgColor: { rgb: "FFFEE2E2" } }, 
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
          
          const canvas = document.createElement('canvas');
          canvas.width = 350;
          canvas.height = 80;
          const ctx = canvas.getContext('2d');
           
          // Texto de la empresa
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 28px Arial';
          ctx.fillText('ABARROTES ED & E', 10, 40);
           
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 14px Arial';
          ctx.fillText('TU MERCADO DE CONFIANZA', 10, 62);

          const logoData = canvas.toDataURL('image/png');
          
          // Insertar logo
          doc.addImage(logoData, 'PNG', 14, 10, 87.5, 20);
          
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
                      data.cell.styles.textColor = [153, 27, 27]; 
                      data.cell.styles.fillColor = [254, 226, 226]; 
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

  const handleExportReturnsConfirm = async () => {
    try {
      const report = await fetchReturnsReport();
      
      if (report.length === 0) {
        alert("No hay devoluciones para exportar");
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(todayStart.getTime() - distanceToMonday * 24 * 60 * 60 * 1000);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let filteredReport = [...report];
      if (returnsExportPeriod === 'daily') {
          filteredReport = report.filter(item => new Date(item.created_at) >= todayStart);
      } else if (returnsExportPeriod === 'weekly') {
          filteredReport = report.filter(item => new Date(item.created_at) >= weekStart);
      } else if (returnsExportPeriod === 'monthly') {
          filteredReport = report.filter(item => new Date(item.created_at) >= monthStart);
      }

      if (filteredReport.length === 0) {
        alert("No hay devoluciones en el período seleccionado");
        return;
      }

      const sortedReport = [...filteredReport].sort((a, b) => a.id - b.id);
      
      let exportData = sortedReport.map(item => {
          const date = new Date(item.created_at);
          const formattedDate = isNaN(date.getTime()) 
            ? item.created_at.replace("T", " ").split(".")[0] 
            : date.toLocaleString('es-MX', { hour12: false });
          return {
              'ID Devolución': item.id,
              'ID Venta': item.sale_id,
              'Fecha / Hora': formattedDate,
              'Producto': item.product_name,
              'Cantidad Devuelta': item.quantity,
              'Precio Unitario ($)': item.price,
              'Monto Devuelto ($)': item.quantity * item.price,
              'Motivo': item.reason || 'Sin especificar'
          };
      });

      const totalAmount = exportData.reduce((sum, item) => sum + item['Monto Devuelto ($)'], 0);
      const totalQuantity = exportData.reduce((sum, item) => sum + item['Cantidad Devuelta'], 0);

      const summaryRow = {
          'ID Devolución': '',
          'ID Venta': '',
          'Fecha / Hora': '',
          'Producto': 'TOTAL GENERAL:',
          'Cantidad Devuelta': totalQuantity,
          'Precio Unitario ($)': '',
          'Monto Devuelto ($)': totalAmount,
          'Motivo': ''
      };
      exportData.push(summaryRow);

      const periodText = returnsExportPeriod === 'daily' ? 'Diario' : returnsExportPeriod === 'weekly' ? 'Semanal' : returnsExportPeriod === 'monthly' ? 'Mensual' : 'Completo';
      const filename = `reporte_devoluciones_${returnsExportPeriod}.${returnsExportFormat}`;

      if (returnsExportFormat === 'xlsx') {
          const workbook = XLSX.utils.book_new();
          const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

          const aoa = [
            ['ABARROTES ED & E'], 
            ['Reporte de Devoluciones y Cancelaciones: ' + periodText],
            ['Fecha de Emisión: ' + dateStr],
            [], 
            Object.keys(exportData[0]) 
          ];
          
          exportData.forEach(obj => {
             aoa.push(Object.values(obj));
          });

          const worksheet = XLSX.utils.aoa_to_sheet(aoa);
          
          worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }
          ];

          worksheet['A1'].s = {
              font: { bold: true, sz: 16, color: { rgb: "FFEF4444" } }, 
              alignment: { horizontal: "center", vertical: "center" }
          };
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
                  
                  if (r === range.e.r) {
                      worksheet[cellRef].s = {
                          font: { bold: true, color: { rgb: "FF991B1B" } }, 
                          fill: { fgColor: { rgb: "FFFEE2E2" } }, 
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

          worksheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 28 }];
          XLSX.utils.book_append_sheet(workbook, worksheet, "Devoluciones");
          XLSX.writeFile(workbook, filename);
      } else if (returnsExportFormat === 'json') {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode); 
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (returnsExportFormat === 'csv') {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
          const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvOutput);
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", filename);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (returnsExportFormat === 'txt') {
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
      } else if (returnsExportFormat === 'xml') {
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
      } else if (returnsExportFormat === 'pdf') {
          const doc = new jsPDF();
          const canvas = document.createElement('canvas');
          canvas.width = 350;
          canvas.height = 80;
          const ctx = canvas.getContext('2d');
           
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 28px Arial';
          ctx.fillText('ABARROTES ED & E', 10, 40);
           
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 14px Arial';
          ctx.fillText('TU MERCADO DE CONFIANZA', 10, 62);

          const logoData = canvas.toDataURL('image/png');
          doc.addImage(logoData, 'PNG', 14, 10, 87.5, 20);
          
          doc.setFontSize(22);
          doc.setTextColor(31, 41, 55);
          doc.text('Reporte de Devoluciones', 14, 45);
          
          const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
          
          doc.setFontSize(11);
          doc.setTextColor(107, 114, 128);
          doc.text(`Período: ${periodText}   |   Fecha de Emisión: ${dateStr}`, 14, 53);
          
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.5);
          doc.line(14, 58, 196, 58);

          const head = [Object.keys(exportData[0])];
          const body = exportData.map(obj => Object.values(obj));
          
          autoTable(doc, {
              head: head,
              body: body,
              startY: 65,
              theme: 'grid',
              headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [254, 242, 242] },
              styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
              didParseCell: function (data) {
                  if (data.section === 'body' && data.row.index === body.length - 1) {
                      data.cell.styles.fontStyle = 'bold';
                      data.cell.styles.textColor = [153, 27, 27]; 
                      data.cell.styles.fillColor = [254, 226, 226]; 
                  }
              }
          });
          
          doc.save(filename);
      }
      
      setIsReturnsExportModalOpen(false);
    } catch (error) {
      console.error("Error generating returns export", error);
      alert("Hubo un error al generar el reporte de devoluciones");
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
            ['ABARROTES ED & E'], 
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
          canvas.width = 350; canvas.height = 80;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0f172a'; ctx.font = 'bold 28px Arial'; ctx.fillText('ABARROTES ED & E', 10, 40);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 14px Arial'; ctx.fillText('TU MERCADO DE CONFIANZA', 10, 62);
          const logoData = canvas.toDataURL('image/png');
          
          doc.addImage(logoData, 'PNG', 14, 10, 87.5, 20);
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
          let sqlOutput = "-- Reporte de Inventario Abarrotes ED & E\n";
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <h2 className="text-2xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center whitespace-nowrap">
          <Package className="mr-3 text-chiluda-red w-8 h-8 shrink-0" />
          Gestión de Inventario
        </h2>

        <div className="flex flex-wrap gap-3 items-center animate-fade-in w-full xl:w-auto justify-start xl:justify-end shrink-0">
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="flex items-center space-x-2 bg-white/90 backdrop-blur-xl border border-stone-205 text-stone-600 px-5 py-2.5 rounded-full hover:bg-stone-50 hover:text-chiluda-red hover:border-chiluda-red/30 hover:shadow-soft active:scale-[0.98] transition-all duration-300 font-bold text-xs"
          >
            <Download size={16} />
            <span>Exportar Stock</span>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-2 bg-white/90 backdrop-blur-xl border border-stone-205 text-stone-600 px-5 py-2.5 rounded-full hover:bg-stone-50 hover:text-chiluda-red hover:border-chiluda-red/30 hover:shadow-soft active:scale-[0.98] transition-all duration-300 font-bold text-xs"
          >
            <Download size={16} />
            <span>Exportar Ventas</span>
          </button>
          <button
            onClick={() => setIsReturnsExportModalOpen(true)}
            className="flex items-center space-x-2 bg-white/90 backdrop-blur-xl border border-stone-205 text-stone-600 px-5 py-2.5 rounded-full hover:bg-stone-50 hover:text-chiluda-red hover:border-chiluda-red/30 hover:shadow-soft active:scale-[0.98] transition-all duration-300 font-bold text-xs"
          >
            <Download size={16} />
            <span>Exportar Devoluciones</span>
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setNewProduct({ name: '', barcode: '', price: '', cost_price: '0', quantity: '', min_stock: '3', entry_date: '', image: '' });
              setProductVariants([]);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float font-black text-xs"
          >
            <Plus size={16} />
            <span>Nuevo Producto</span>
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

      <div className="bg-white/5 backdrop-blur-[2px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
        {/* Toolbar */}
        <div className="p-4 md:p-6 border-b border-gray-100/50 flex flex-col md:flex-row items-start md:items-center justify-between bg-white/40 gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="w-full pl-11 pr-10 py-2.5 bg-brand-50/50 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-chiluda-red focus:border-transparent focus:bg-white transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchTerm('')}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-full active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            )}
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
              {filteredInventory.map((item) => {
                return (
                  <tr key={item.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                    <td className="px-3 md:px-6 py-3 md:py-4 max-w-[120px] md:max-w-none truncate">
                      <div className="flex items-center space-x-3">
                        <div className="truncate">
                          <span className="font-bold text-gray-950 text-sm md:text-base block truncate">{item.name}</span>
                          {item.barcode && <span className="text-[10px] md:text-xs text-gray-400 mt-0.5 block truncate">Cód: {item.barcode}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right text-gray-600 text-sm md:text-base">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${
                        item.quantity <= (item.min_stock ?? 3) ? 'bg-red-105 text-red-800 animate-pulse border border-red-200' : 'bg-green-150 text-green-800'
                      }`}>
                        {item.quantity} u. (Min: {item.min_stock ?? 3})
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
                        <button 
                          type="button" 
                          onClick={() => handleEdit(item)} 
                          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 p-2.5 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 size={18} className="md:w-[20px] md:h-[20px]" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDelete(item.id)} 
                          className="text-gray-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 p-2.5 rounded-xl transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={18} className="md:w-[20px] md:h-[20px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo/Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingProduct ? 'Modificar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Columna Izquierda: Datos del Producto */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Ej. Papas Fuego"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras (Opcional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
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
                            cost_price: existing.cost_price || 0,
                            quantity: '',
                            min_stock: existing.min_stock || 3,
                            entry_date: existing.entry_date || '',
                            image: existing.image || ''
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio Costo ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                        value={newProduct.cost_price}
                        onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                        value={newProduct.quantity}
                        onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                      <input
                        type="number"
                        min="1"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                        value={newProduct.min_stock}
                        onChange={(e) => setNewProduct({ ...newProduct, min_stock: e.target.value })}
                        placeholder="3"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-chiluda-red/50 focus:border-chiluda-red text-sm"
                      value={newProduct.entry_date}
                      onChange={(e) => setNewProduct({ ...newProduct, entry_date: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Si se deja vacío, se asignará la fecha actual.</p>
                  </div>

                </div>

                {/* Columna Derecha: Gestor de Variantes */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-brand-900 tracking-wider mb-2">Variantes (Opcional):</h4>
                    <div className="bg-brand-50/50 p-3 rounded-2xl border border-gray-200/50 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nombre (ej. M, Fresa)"
                          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-brand-900"
                          value={newVariant.name}
                          onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Cod. Barras"
                          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-brand-900"
                          value={newVariant.barcode}
                          onChange={(e) => setNewVariant({ ...newVariant, barcode: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Costo"
                          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-brand-900"
                          value={newVariant.cost_price}
                          onChange={(e) => setNewVariant({ ...newVariant, cost_price: e.target.value })}
                        />
                        <input
                          type="number"
                          placeholder="Precio"
                          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-brand-900"
                          value={newVariant.price}
                          onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                        />
                        <input
                          type="number"
                          placeholder="Stock"
                          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-brand-900"
                          value={newVariant.quantity}
                          onChange={(e) => setNewVariant({ ...newVariant, quantity: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newVariant.name.trim()) {
                            alert("Nombre de variante requerido");
                            return;
                          }
                          setProductVariants([...productVariants, { ...newVariant }]);
                          setNewVariant({ name: '', barcode: '', cost_price: '', price: '', quantity: '0' });
                        }}
                        className="w-full py-1.5 bg-brand-900 text-white text-xs font-bold rounded-lg hover:bg-brand-950 transition-colors"
                      >
                        + Agregar Variante
                      </button>
                    </div>
                  </div>

                  {/* Lista de Variantes Agregadas */}
                  <div className="space-y-1.5 flex-1 max-h-48 overflow-y-auto mt-2 pr-1">
                    {productVariants.length === 0 ? (
                      <div className="text-[11px] text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                        Sin variantes agregadas
                      </div>
                    ) : (
                      productVariants.map((v, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-shadow">
                          <div className="overflow-hidden pr-2">
                            <span className="font-extrabold text-brand-900 block truncate">{v.name}</span>
                            {v.barcode && <span className="text-[9px] text-gray-400 block truncate">@{v.barcode}</span>}
                            <div className="text-[9px] text-gray-400 mt-0.5 font-medium">
                              Costo: ${v.cost_price || 'Padre'} | Precio: ${v.price || 'Padre'} | Stock: {v.quantity}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setProductVariants(productVariants.filter((_, subIdx) => subIdx !== idx))}
                            className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              </div>
              
              {/* Botones de Acción */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-end space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-white transition-colors text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors text-sm font-bold shadow-sm"
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
      {/* Modal Exportar Devoluciones */}
      {isReturnsExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Reporte de Devoluciones</h3>
              <button onClick={() => setIsReturnsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periodo del Reporte</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['daily', 'weekly', 'monthly', 'all'].map(p => (
                    <button
                      key={p}
                      onClick={() => setReturnsExportPeriod(p)}
                      className={`px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        returnsExportPeriod === p 
                        ? 'bg-red-50 border-chiluda-red text-chiluda-red' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p === 'daily' ? 'Hoy' : p === 'weekly' ? 'Semana' : p === 'monthly' ? 'Mes' : 'Todo'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Archivo</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['xlsx', 'csv', 'txt', 'json', 'xml', 'pdf'].map(f => (
                    <button
                      key={f}
                      onClick={() => setReturnsExportFormat(f)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium uppercase transition-colors ${
                        returnsExportFormat === f 
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
                  onClick={() => setIsReturnsExportModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportReturnsConfirm}
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
