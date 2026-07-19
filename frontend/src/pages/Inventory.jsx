import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
import { createPortal } from 'react-dom';
import { Download, Plus, Search, Edit2, Trash2, X, Package, ChevronDown, TrendingUp, History } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchInventory, createProduct, updateProduct, deleteProduct, fetchSalesReport, fetchReturnsReport, searchProductImage } from '../api';



const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('daily');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [stockExportFormat, setStockExportFormat] = useState('xlsx');
  const [isReturnsExportModalOpen, setIsReturnsExportModalOpen] = useState(false);
  const [returnsExportFormat, setReturnsExportFormat] = useState('xlsx');
  const [returnsExportPeriod, setReturnsExportPeriod] = useState('all');
  const [newProduct, setNewProduct] = useState({ name: '', codigo_barras: '', precio: '', precio_costo: '0', cantidad: '', inventario_minimo: '3', fecha_entrada: '', imagen: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [productVariants, setProductVariants] = useState([]);
  const [newVariant, setNewVariant] = useState({ name: '', codigo_barras: '', precio_costo: '', precio: '', cantidad: '0' });
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

  // Debounced auto-search for producto imagen when name is typed
  useEffect(() => {
    if (!newProduct.name || newProduct.name.trim().length < 3) return;
    if (newProduct.imagen && newProduct.imagen.trim() !== '') return;

    const delayDebounceFn = setTimeout(() => {
      if (!newProduct.imagen || newProduct.imagen.trim() === '') {
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
        setNewProduct(prev => ({ ...prev, imagen: reader.result }));
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
        setNewProduct(prev => ({ ...prev, imagen: data.image_url }));
      }
    } catch (err) {
      console.error("Failed to auto-search producto imagen:", err);
    } finally {
      setIsSearchingImage(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        name: newProduct.name,
        codigo_barras: newProduct.codigo_barras || null,
        precio: parseFloat(newProduct.precio),
        precio_costo: parseFloat(newProduct.precio_costo) || 0.0,
        cantidad: parseInt(newProduct.cantidad),
        inventario_minimo: parseInt(newProduct.inventario_minimo) || 3,
        fecha_entrada: newProduct.fecha_entrada || new Date().toISOString().split('T')[0],
        imagen: newProduct.imagen || null,
        variantes: productVariants.map(v => ({
          name: v.name,
          codigo_barras: v.codigo_barras || null,
          precio_costo: v.precio_costo ? parseFloat(v.precio_costo) : null,
          precio: v.precio ? parseFloat(v.precio) : null,
          cantidad: parseInt(v.cantidad) || 0
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
      setNewProduct({ name: '', codigo_barras: '', precio: '', precio_costo: '0', cantidad: '', inventario_minimo: '3', fecha_entrada: '', imagen: '' });
      setProductVariants([]);
      setEditingProduct(null);
      loadData();
    } catch (err) {
      console.error("Error saving producto", err);
      setError("Hubo un error al guardar el producto");
    }
  };

  const handleEdit = (producto) => {
    setEditingProduct(producto);
    setNewProduct({
      name: producto.name,
      codigo_barras: producto.codigo_barras || '',
      precio: producto.precio,
      precio_costo: producto.precio_costo || 0,
      cantidad: producto.cantidad,
      inventario_minimo: producto.inventario_minimo || 3,
      fecha_entrada: producto.fecha_entrada || '',
      imagen: producto.imagen || ''
    });
    setProductVariants(producto.variantes || []);
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
      console.error("Error deleting producto", err);
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
              'Stock Actual': item.cantidad,
              'Precio Unitario ($)': item.precio,
              'Vendidos Hoy': item.sales_today,
              'Monto Vendido ($)': item.revenue_today
          }));
          baseFilename = 'ventas_por_dia';
      } else if (exportPeriod === 'weekly') {
          exportData = sortedReport.map(item => ({
              'Producto': item.name || '',
              'Stock Actual': item.cantidad,
              'Precio Unitario ($)': item.precio,
              'Vendidos Semana': item.sales_week,
              'Total Ventas ($)': item.revenue_week
          }));
          baseFilename = 'ventas_por_semana';
      } else if (exportPeriod === 'monthly') {
          exportData = sortedReport.map(item => ({
              'Producto': item.name || '',
              'Stock Actual': item.cantidad,
              'Precio Unitario ($)': item.precio,
              'Vendidos Mes': item.sales_month,
              'Total Ventas ($)': item.revenue_month
          }));
          baseFilename = 'ventas_por_mes';
      }

      // Calculate total monto
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

          const logoData = canvas.toDataURL('imagen/png');
          
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
          filteredReport = report.filter(item => new Date(item.creado_en) >= todayStart);
      } else if (returnsExportPeriod === 'weekly') {
          filteredReport = report.filter(item => new Date(item.creado_en) >= weekStart);
      } else if (returnsExportPeriod === 'monthly') {
          filteredReport = report.filter(item => new Date(item.creado_en) >= monthStart);
      }

      if (filteredReport.length === 0) {
        alert("No hay devoluciones en el período seleccionado");
        return;
      }

      const sortedReport = [...filteredReport].sort((a, b) => a.id - b.id);
      
      let exportData = sortedReport.map(item => {
          const date = new Date(item.creado_en);
          const formattedDate = isNaN(date.getTime()) 
            ? item.creado_en.replace("T", " ").split(".")[0] 
            : date.toLocaleString('es-MX', { hour12: false });
          return {
              'ID Devolución': item.id,
              'ID Venta': item.venta_id,
              'Fecha / Hora': formattedDate,
              'Producto': item.nombre_producto,
              'Cantidad Devuelta': item.cantidad,
              'Precio Unitario ($)': item.precio,
              'Monto Devuelto ($)': item.cantidad * item.precio,
              'Motivo': item.motivo || 'Sin especificar'
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

          const logoData = canvas.toDataURL('imagen/png');
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
          'Precio ($)': item.precio,
          'Stock Actual': item.cantidad,
          'Fecha Ingreso': item.fecha_entrada || 'N/A'
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
          const logoData = canvas.toDataURL('imagen/png');
          
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
          sqlOutput += "CREATE TABLE IF NOT EXISTS products (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(255),\n  precio DECIMAL(10,2),\n  cantidad INTEGER\n);\n\n";
          
          inventory.forEach(item => {
             const safeName = (item.name || '').replace(/'/g, "''");
             sqlOutput += `INSERT INTO products (id, name, precio, cantidad) VALUES (${item.id}, '${safeName}', ${item.precio}, ${item.cantidad});\n`;
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
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
          <Package className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>Gestión de Inventario</span>
        </h2>

        <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center animate-fade-in w-full xl:w-auto justify-center sm:justify-end shrink-0 relative">
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white/95 backdrop-blur-xl border border-stone-200 text-stone-600 px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-full hover:bg-stone-50 hover:text-chiluda-red hover:border-chiluda-red/30 hover:shadow-soft active:scale-[0.98] transition-all duration-300 font-bold text-xs uppercase tracking-wider"
            >
              <Download size={15} />
              <span>Exportar Reportes</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsExportDropdownOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-full sm:w-72 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-stone-200/60 overflow-hidden z-50 animate-slide-up p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsStockModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl hover:bg-stone-50 text-left transition-all duration-200 group"
                    style={{ textTransform: 'none' }}
                  >
                    <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors duration-200">
                      <Package size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-brand-900 group-hover:text-chiluda-red transition-colors duration-200 uppercase tracking-wider">Exportar Stock</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 leading-tight">Inventario actual en formato Excel, PDF o SQL</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl hover:bg-stone-50 text-left transition-all duration-200 group"
                    style={{ textTransform: 'none' }}
                  >
                    <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-200">
                      <TrendingUp size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-brand-900 group-hover:text-chiluda-red transition-colors duration-200 uppercase tracking-wider">Exportar Ventas</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 leading-tight">Ventas históricas diarias, semanales o mensuales</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsReturnsExportModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl hover:bg-stone-50 text-left transition-all duration-200 group"
                    style={{ textTransform: 'none' }}
                  >
                    <div className="p-2 bg-red-500/10 text-red-650 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-colors duration-200">
                      <History size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-brand-900 group-hover:text-chiluda-red transition-colors duration-200 uppercase tracking-wider">Exportar Devoluciones</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 leading-tight">Cancelaciones y devoluciones con filtro por periodo</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setEditingProduct(null);
              setNewProduct({ name: '', codigo_barras: '', precio: '', precio_costo: '0', cantidad: '', inventario_minimo: '3', fecha_entrada: '', imagen: '' });
              setProductVariants([]);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float font-black text-xs"
          >
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={!!success}
        tipo="success"
        mensaje={success}
        onClose={() => setSuccess('')}
      />
      <AlertModal
        isOpen={!!error}
        tipo="error"
        mensaje={error}
        onClose={() => setError('')}
      />

      {deleteConfirm && createPortal(
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
        </div>,
        document.body
      )}

      <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
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
          <table className="w-full text-center border-collapse">
            <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-center rounded-tl-xl">Producto</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-center">Precio</th>
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
                    <td className="px-3 md:px-6 py-3 md:py-4 max-w-[120px] md:max-w-none truncate text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <div className="truncate">
                          <span className="font-bold text-gray-950 text-sm md:text-base block truncate">{item.name}</span>
                          {item.codigo_barras && <span className="text-[10px] md:text-xs text-gray-400 mt-0.5 block truncate">Cód: {item.codigo_barras}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-600 text-sm md:text-base">
                      ${item.precio.toFixed(2)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${
                        item.cantidad <= (item.inventario_minimo ?? 3) ? 'bg-red-105 text-red-800 animate-pulse border border-red-200' : 'bg-green-150 text-green-800'
                      }`}>
                        {item.cantidad} u. (Min: {item.inventario_minimo ?? 3})
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-center text-gray-600 text-sm md:text-base">
                      {item.fecha_entrada || '-'}
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-center text-gray-600 text-sm md:text-base">
                      {item.vendido} u.
                    </td>
                    <td className="hidden lg:table-cell px-3 md:px-6 py-3 md:py-4 text-center">
                      <span className="text-gray-500 text-sm">
                        {Math.max(0, 50 - item.cantidad)} u.
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
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
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl lg:max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Package className="text-emerald-600 w-5 h-5 shrink-0" />
                <span>{editingProduct ? 'MODIFICAR PRODUCTO' : 'REGISTRAR PRODUCTO'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-6 overflow-y-auto flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Columna Izquierda: Datos del Producto */}
                  <div className="space-y-4">
                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Producto *</label>
                      <input
                        type="text"
                        required
                        className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="Ej. Papas Fuego"
                      />
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Código de Barras (Opcional)</label>
                      <input
                        type="text"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                        value={newProduct.codigo_barras}
                        onChange={(e) => {
                          const val = e.target.value;
                          const existing = inventory.find(p => p.codigo_barras && p.codigo_barras === val);
                          
                          if (existing) {
                            setEditingProduct(existing);
                            setNewProduct({
                              name: existing.name,
                              codigo_barras: existing.codigo_barras,
                              precio: existing.precio,
                              precio_costo: existing.precio_costo || 0,
                              cantidad: '',
                              inventario_minimo: existing.inventario_minimo || 3,
                              fecha_entrada: existing.fecha_entrada || '',
                              imagen: existing.imagen || ''
                            });
                          } else {
                            setNewProduct({ ...newProduct, codigo_barras: val });
                          }
                        }}
                        placeholder="Escanea o escribe el código"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Precio Costo ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                          value={newProduct.precio_costo}
                          onChange={(e) => setNewProduct({ ...newProduct, precio_costo: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Precio Venta ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                          value={newProduct.precio}
                          onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Inicial *</label>
                        <input
                          type="number"
                          min="0"
                          required
                          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                          value={newProduct.cantidad}
                          onChange={(e) => setNewProduct({ ...newProduct, cantidad: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Mínimo *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                          value={newProduct.inventario_minimo}
                          onChange={(e) => setNewProduct({ ...newProduct, inventario_minimo: e.target.value })}
                          placeholder="3"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de Ingreso</label>
                      <input
                        type="date"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                        value={newProduct.fecha_entrada}
                        onChange={(e) => setNewProduct({ ...newProduct, fecha_entrada: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Si se deja vacío, se asignará la fecha actual.</p>
                    </div>
                  </div>

                  {/* Columna Derecha: Gestor de Variantes */}
                  <div className="space-y-4 md:border-l md:border-t-0 border-t border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-start">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Variantes (Opcional):</h4>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Nombre (ej. M, Fresa)"
                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={newVariant.name}
                            onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="Cod. Barras"
                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={newVariant.codigo_barras}
                            onChange={(e) => setNewVariant({ ...newVariant, codigo_barras: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            placeholder="Costo"
                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={newVariant.precio_costo}
                            onChange={(e) => setNewVariant({ ...newVariant, precio_costo: e.target.value })}
                          />
                          <input
                            type="number"
                            placeholder="Precio"
                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={newVariant.precio}
                            onChange={(e) => setNewVariant({ ...newVariant, precio: e.target.value })}
                          />
                          <input
                            type="number"
                            placeholder="Stock"
                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={newVariant.cantidad}
                            onChange={(e) => setNewVariant({ ...newVariant, cantidad: e.target.value })}
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
                            setNewVariant({ name: '', codigo_barras: '', precio_costo: '', precio: '', cantidad: '0' });
                          }}
                          className="w-full py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shadow-sm uppercase tracking-wider"
                        >
                          + Agregar Variante
                        </button>
                      </div>
                    </div>

                    {/* Lista de Variantes Agregadas */}
                    <div className="space-y-1.5 flex-1 max-h-48 overflow-y-auto mt-2 pr-1">
                      {productVariants.length === 0 ? (
                        <div className="text-[11px] text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          Sin variantes agregadas
                        </div>
                      ) : (
                        productVariants.map((v, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-2xl text-xs font-semibold shadow-sm hover:shadow transition-shadow">
                            <div className="overflow-hidden pr-2">
                              <span className="font-extrabold text-slate-800 block truncate">{v.name}</span>
                              {v.codigo_barras && <span className="text-[9px] text-slate-400 block truncate">@{v.codigo_barras}</span>}
                              <div className="text-[9px] text-slate-400 mt-0.5 font-medium">
                                Costo: ${v.precio_costo || 'Padre'} | Precio: ${v.precio || 'Padre'} | Stock: {v.cantidad}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setProductVariants(productVariants.filter((_, subIdx) => subIdx !== idx))}
                              className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              {/* Botones de Acción */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-all text-sm uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all text-sm uppercase shadow-sm shadow-emerald-600/10 active:scale-95"
                >
                  {editingProduct ? 'Guardar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Exportar */}
      {isExportModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Reportes</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
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
        </div>,
        document.body
      )}
      {/* Modal Exportar Stock */}
      {isStockModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Inventario Actual</h3>
              <button onClick={() => setIsStockModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
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
        </div>,
        document.body
      )}
      {/* Modal Exportar Devoluciones */}
      {isReturnsExportModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Exportar Reporte de Devoluciones</h3>
              <button onClick={() => setIsReturnsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default Inventory;
