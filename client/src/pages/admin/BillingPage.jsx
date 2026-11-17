import { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import API from "../../api/axios";
import { toast } from "sonner";

export default function BillingPage() {
  const [billing, setBilling] = useState([]);

  const fetchBilling = async () => {
    try {
      const res = await API.get("/billing");
      setBilling(res.data);
    } catch (err) {
      toast.error("error fetching billing data: " + (err.response?.data?.message || err.message || "Server error"));
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("are you sure?")) return;
    try {
      await API.delete(`/billing/${id}`);
      toast.success("deleted successfully");
      fetchBilling();
    } catch (err) {
      toast.error("error deleting account: " + (err.response?.data?.message || err.message || "Server error"));
    }
  };

  return (
    <div className="p-4 text-black dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Billing Accounts</h1>
        <Link to="/billing/new" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition duration-200">
          + New Account
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
        <table className="w-full text-sm text-black dark:text-white bg-white dark:bg-gray-800">
          <thead className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 text-white font-semibold">
            <tr>
              <th className="p-3 text-left whitespace-nowrap">Full Name</th>
              <th className="p-3 text-left whitespace-nowrap">Legal Name</th>
              <th className="p-3 text-left whitespace-nowrap">Email</th>
              <th className="p-3 text-left whitespace-nowrap">Phone 1</th>
              <th className="p-3 text-left whitespace-nowrap">Phone 2</th>
              <th className="p-3 text-left whitespace-nowrap">DOB</th>
              <th className="p-3 text-left whitespace-nowrap">Address</th>
              <th className="p-3 text-left whitespace-nowrap">City</th>
              <th className="p-3 text-left whitespace-nowrap">State</th>
              <th className="p-3 text-left whitespace-nowrap">Zip</th>
              <th className="p-3 text-left whitespace-nowrap">EIN</th>
              <th className="p-3 text-left whitespace-nowrap">Reputation</th>
              <th className="p-3 text-left whitespace-nowrap">Notes</th>
              <th className="p-3 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {billing.length === 0 ? (
              <tr>
                <td colSpan="14" className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No billing accounts found
                </td>
              </tr>
            ) : (
              billing.map((b) => (
                <tr key={b.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                  <td className="p-3">{b.full_name || "—"}</td>
                  <td className="p-3">{b.legal_name || "—"}</td>
                  <td className="p-3 text-blue-600 dark:text-blue-400">{b.email || "—"}</td>
                  <td className="p-3">{b.phone1 || "—"}</td>
                  <td className="p-3">{b.phone2 || "—"}</td>
                  <td className="p-3">{b.dob || "—"}</td>
                  <td className="p-3">{b.address || "—"}</td>
                  <td className="p-3">{b.city || "—"}</td>
                  <td className="p-3">{b.state || "—"}</td>
                  <td className="p-3">{b.zip || "—"}</td>
                  <td className="p-3 font-mono">{b.ein || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      b.reputation === "good" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                      b.reputation === "bad" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {b.reputation || "—"}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate" title={b.notes}>{b.notes || "—"}</td>
                  <td className="p-3 flex gap-3 justify-center items-center">
                    <Link to={`/billing/${b.id}/edit`} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition font-medium text-xs">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(b.id)} className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition font-medium text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
