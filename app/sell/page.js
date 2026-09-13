"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (ไว้ใช้ใน dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มการขาย
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg("โหลดรายการสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // หาข้อมูลสินค้าที่เลือกอยู่ตอนนี้ จาก id
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน (ถ้ากรอกไม่ครบให้เป็น 0)
  const qtyNumber = Number(quantity) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  const resetForm = () => {
    setSelectedProductId("");
    setQuantity("");
  };

  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }

    // ตรวจสอบว่าสินค้าคงเหลือพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg("บันทึกการขายไม่สำเร็จ: " + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (updateError) {
      setErrorMsg(
        "บันทึกการขายสำเร็จ แต่ปรับสต๊อกไม่สำเร็จ: " + updateError.message
      );
      setSubmitting(false);
      return;
    }

    setSuccessMsg(
      `ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (ยอดรวม ${totalPrice} บาท)`
    );
    resetForm();
    fetchProducts(); // โหลดสินค้าใหม่เพื่อให้ stock อัปเดต
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && (
        <div style={{ color: "#dc2626", marginBottom: "12px" }}>{errorMsg}</div>
      )}
      {successMsg && (
        <div style={{ color: "#16a34a", marginBottom: "12px" }}>{successMsg}</div>
      )}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : products.length === 0 ? (
          <p>ยังไม่มีสินค้าในระบบ กรุณาเพิ่มสินค้าที่หน้าแรกก่อน</p>
        ) : (
          <form onSubmit={handleSell} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "360px" }}>
            {/* Dropdown เลือกสินค้า */}
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                เลือกสินค้า
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price} บาท (คงเหลือ {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* จำนวนที่จะขาย */}
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                จำนวน
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* ยอดรวมอัตโนมัติ */}
            <div className="card" style={{ background: "#f3f4f6", padding: "12px" }}>
              <strong>ยอดรวม: {totalPrice.toFixed(2)} บาท</strong>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "ขาย"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
