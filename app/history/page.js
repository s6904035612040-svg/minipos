"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // โหลดประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  const fetchSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("sold_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดประวัติการขายไม่สำเร็จ: " + error.message);
    } else {
      setSales(data);
      setErrorMsg("");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // รวมยอดขายทั้งหมดจากทุกแถว
  const totalSales = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // แปลง timestamp ให้อ่านง่ายแบบไทย
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {errorMsg && (
        <div style={{ color: "#dc2626", marginBottom: "12px" }}>{errorMsg}</div>
      )}

      {/* ยอดขายรวมทั้งหมด */}
      <div className="card" style={{ background: "#f3f4f6" }}>
        <strong style={{ fontSize: "18px" }}>
          ยอดขายรวมทั้งหมด: {totalSales.toFixed(2)} บาท
        </strong>
      </div>

      {/* ตารางประวัติการขาย */}
      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : sales.length === 0 ? (
          <p>ยังไม่มีประวัติการขาย</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>วันเวลาที่ขาย</th>
                <th>ชื่อสินค้า</th>
                <th>จำนวน</th>
                <th>ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{formatDateTime(s.sold_at)}</td>
                  <td>{s.product_name}</td>
                  <td>{s.quantity}</td>
                  <td>{Number(s.total_price).toFixed(2)} บาท</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
