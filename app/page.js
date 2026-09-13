"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });

  // แถวที่กำลังแก้ไขอยู่ (inline edit) — เก็บ id ของแถว + ค่าที่แก้ไข
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดข้อมูลสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
      setErrorMsg("");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลงตาราง products
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock),
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
      return;
    }

    // เคลียร์ฟอร์มแล้วโหลดรายการใหม่
    setForm({ sku: "", name: "", price: "", stock: "", unit: "" });
    fetchProducts();
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmed = window.confirm("ยืนยันการลบสินค้านี้หรือไม่?");
    if (!confirmed) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setErrorMsg("ลบสินค้าไม่สำเร็จ: " + error.message);
      return;
    }
    fetchProducts();
  };

  // เริ่มแก้ไขแถว — ดึงค่าปัจจุบันของแถวนั้นมาใส่ editForm
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขแถว
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg("แก้ไขสินค้าไม่สำเร็จ: " + error.message);
      return;
    }

    setEditingId(null);
    setEditForm({});
    fetchProducts();
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && (
        <div style={{ color: "#dc2626", marginBottom: "12px" }}>{errorMsg}</div>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้าใหม่</h2>
        <form
          onSubmit={handleAddProduct}
          style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            name="sku"
            placeholder="SKU"
            value={form.sku}
            onChange={handleFormChange}
            style={{ width: "110px" }}
          />
          <input
            name="name"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={handleFormChange}
            style={{ width: "180px" }}
          />
          <input
            name="price"
            type="number"
            step="0.01"
            placeholder="ราคา"
            value={form.price}
            onChange={handleFormChange}
            style={{ width: "100px" }}
          />
          <input
            name="stock"
            type="number"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={handleFormChange}
            style={{ width: "90px" }}
          />
          <input
            name="unit"
            placeholder="หน่วย"
            value={form.unit}
            onChange={handleFormChange}
            style={{ width: "90px" }}
          />
          <button type="submit">เพิ่มสินค้า</button>
        </form>
      </div>

      {/* ตารางรายการสินค้า */}
      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : products.length === 0 ? (
          <p>ยังไม่มีสินค้าในระบบ</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>ชื่อสินค้า</th>
                <th>ราคา</th>
                <th>คงเหลือ</th>
                <th>หน่วย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            name="sku"
                            value={editForm.sku}
                            onChange={handleEditChange}
                            style={{ width: "90px" }}
                          />
                        </td>
                        <td>
                          <input
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                            style={{ width: "140px" }}
                          />
                        </td>
                        <td>
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            value={editForm.price}
                            onChange={handleEditChange}
                            style={{ width: "80px" }}
                          />
                        </td>
                        <td>
                          <input
                            name="stock"
                            type="number"
                            value={editForm.stock}
                            onChange={handleEditChange}
                            style={{ width: "70px" }}
                          />
                        </td>
                        <td>
                          <input
                            name="unit"
                            value={editForm.unit}
                            onChange={handleEditChange}
                            style={{ width: "70px" }}
                          />
                        </td>
                        <td style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => handleSaveEdit(p.id)}>บันทึก</button>
                          <button
                            onClick={cancelEdit}
                            style={{ background: "#9ca3af" }}
                          >
                            ยกเลิก
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{p.sku}</td>
                        <td>{p.name}</td>
                        <td>{p.price}</td>
                        <td>{p.stock}</td>
                        <td>{p.unit}</td>
                        <td style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => startEdit(p)}>แก้ไข</button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            style={{ background: "#dc2626" }}
                          >
                            ลบ
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
