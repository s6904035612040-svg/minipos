"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

// ===== Telegram Config จาก Environment Variables =====
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

// เกณฑ์เตือนภัยสต๊อกเหลือน้อย
const LOW_STOCK_THRESHOLD = 5;

// ฟังก์ชันกลางสำหรับยิงข้อความเข้า Telegram
// ใช้ try-catch ครอบไว้ ถ้า Telegram ล่มจะไม่กระทบระบบขาย
async function sendTelegramMessage(messageText) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("ยังไม่ได้ตั้งค่า Telegram Config");
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: messageText,
          parse_mode: "HTML",
        }),
      }
    );

    if (!res.ok) {
      console.error("ส่ง Telegram ไม่สำเร็จ:", await res.text());
    }
  } catch (err) {
    // กลืน error ไว้ ไม่ให้กระทบการขาย
    console.error("Telegram error:", err);
  }
}

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const selectedProduct = products.find((p) => p.id === selectedProductId);

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

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }
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

    // 2) อัปเดต stock ให้ลดลงตามจำนวนที่ขาย
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

    // ===== 3) แจ้งเตือน Telegram (หลังตัดสต๊อกสำเร็จ) =====
    // ไม่ใส่ await ผูกกับ flow หลัก เพื่อไม่ให้หน่วงการแสดงผลฝั่งเว็บ
    notifyTelegram(selectedProduct, qtyNumber, totalPrice, newStock);

    setSuccessMsg(
      `ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (ยอดรวม ${totalPrice} บาท)`
    );
    resetForm();
    fetchProducts();
    setSubmitting(false);
  };

  // รวมการแจ้งเตือนทั้ง 2 งานไว้ที่เดียว
  const notifyTelegram = async (product, qty, total, newStock) => {
    const timeText = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    // งานที่ 1: แจ้งเตือน Order เข้า
    const orderMsg =
      `🛍️ <b>มีรายการขายใหม่!</b>\n\n` +
      `• สินค้า: ${product.name}\n` +
      `• จำนวน: ${qty} ${product.unit}\n` +
      `• ราคารวม: ${total.toLocaleString()} บาท\n` +
      `• สต๊อกคงเหลือปัจจุบัน: ${newStock} ${product.unit}\n` +
      `• เวลา: ${timeText}`;

    await sendTelegramMessage(orderMsg);

    // งานที่ 2: แจ้งเตือนสต๊อกเหลือน้อย (ยิงแยกอีก 1 ข้อความ)
    if (newStock <= LOW_STOCK_THRESHOLD) {
      const lowStockMsg =
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n\n` +
        `• สินค้า: ${product.name}\n` +
        `• คงเหลือเพียง: ${newStock} ${product.unit}\n\n` +
        `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

      await sendTelegramMessage(lowStockMsg);
    }
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
