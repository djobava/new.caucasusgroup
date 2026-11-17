import { useEffect, useState } from "react";   
import { Link } from "react-router-dom";
import API from "../../api/axios";
import { toast } from "sonner";

const HRDashboard = () => {
  const [driverCount, setDriverCount] = useState(0);
  const [billingCount, setBillingCount] = useState(0);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const getDateStatus = (date) => {
    if (!date) return { status: "unknown", label: "No date", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
    
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    const daysUntil = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { status: "expired", label: `Expired ${Math.abs(daysUntil)} days ago`, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
    }
    if (daysUntil <= 7) {
      return { status: "warning", label: `${daysUntil} days left`, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
    }
    return { status: "good", label: `${daysUntil} days left`, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" };
  };

  const formatDate = (date) => {
    if (!date) return "-";
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const fetchHRStats = async () => {
    try {
      setLoading(true);
      const res = await API.get("/hr");
      const { driverCount, billingCount } = res.data;
      setDriverCount(driverCount);
      setBillingCount(billingCount);
      
      // Fetch drivers for reminders
      const driversRes = await API.get("/drivers");
      setDrivers(driversRes.data || []);
    } catch (err) {
      toast.error("Error fetching HR stats: " + (err.response?.data?.message || err.message || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRStats();
  }, []);

  // Get drivers with issues (expired or expiring within 7 days)
  const driversWithIssues = drivers.filter(driver => {
    const insuranceStatus = getDateStatus(driver.insurance_date);
    const registrationStatus = getDateStatus(driver.registration_date);
    return insuranceStatus.status !== "good" || registrationStatus.status !== "good";
  });

  const expiredDrivers = driversWithIssues.filter(driver => {
    const insuranceStatus = getDateStatus(driver.insurance_date);
    const registrationStatus = getDateStatus(driver.registration_date);
    return insuranceStatus.status === "expired" || registrationStatus.status === "expired";
  });

  const warningDrivers = driversWithIssues.filter(driver => {
    const insuranceStatus = getDateStatus(driver.insurance_date);
    const registrationStatus = getDateStatus(driver.registration_date);
    return (insuranceStatus.status === "warning" || registrationStatus.status === "warning") && 
           insuranceStatus.status !== "expired" && registrationStatus.status !== "expired";
  });

  return (
    <div className="p-4 md:p-6 dark:bg-gray-900 min-h-screen text-black dark:text-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">HR Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Track drivers and billing information</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 px-0 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/drivers" className="block">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow">
            <div className="p-4 bg-green-400 dark:bg-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Drivers</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{driverCount}</p>
            </div>
          </div>
        </Link>

        <Link to="/billing" className="block">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow">
            <div className="p-4 bg-blue-400 dark:bg-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Billing Accounts</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{billingCount}</p>
            </div>
          </div>
        </Link>

        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow">
          <div className="p-4 bg-red-400 dark:bg-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Expired Documents</h3>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{expiredDrivers.length}</p>
          </div>
        </div>

        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow">
          <div className="p-4 bg-yellow-400 dark:bg-yellow-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4v2m0 5v.01M7.08 6.47a7.5 7.5 0 1110.84 10.84M7.08 6.47L5.25 4.64M16.92 17.53l1.83 1.83" />
            </svg>
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Expiring Soon (7 days)</h3>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{warningDrivers.length}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {expiredDrivers.length > 0 && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-3">⚠️ Expired Documents</h3>
          <div className="space-y-2">
            {expiredDrivers.map(driver => (
              <div key={driver.id} className="flex justify-between items-center text-sm text-red-700 dark:text-red-200">
                <span><strong>{driver.unit}</strong> - {driver.name}</span>
                <Link to={`/drivers/${driver.id}/edit`} className="text-red-600 dark:text-red-400 hover:underline">
                  Update
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {warningDrivers.length > 0 && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3">⏰ Expiring Soon (within 7 days)</h3>
          <div className="space-y-2">
            {warningDrivers.map(driver => (
              <div key={driver.id} className="flex justify-between items-center text-sm text-yellow-700 dark:text-yellow-200">
                <span><strong>{driver.unit}</strong> - {driver.name}</span>
                <Link to={`/drivers/${driver.id}/edit`} className="text-yellow-600 dark:text-yellow-400 hover:underline">
                  Update
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Status Table */}
      {!loading && drivers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold">Document Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Driver</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Insurance Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Insurance Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Registration Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Registration Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {driversWithIssues.map(driver => {
                  const insuranceStatus = getDateStatus(driver.insurance_date);
                  const registrationStatus = getDateStatus(driver.registration_date);
                  return (
                    <tr key={driver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-3 font-semibold text-blue-600 dark:text-blue-400">{driver.unit}</td>
                      <td className="px-6 py-3">{driver.name}</td>
                      <td className="px-6 py-3 font-mono text-sm">{formatDate(driver.insurance_date)}</td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${insuranceStatus.color}`}>
                          {insuranceStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-sm">{formatDate(driver.registration_date)}</td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${registrationStatus.color}`}>
                          {registrationStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <Link to={`/drivers/${driver.id}/edit`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && driversWithIssues.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">✅ All driver documents are up to date!</p>
        </div>
      )}
    </div>
  );
};
  
export default HRDashboard;
  