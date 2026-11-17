import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/axios";
import { toast } from "sonner";

const initialState = {
  full_name: "",
  dob: "",
  phone1: "",
  phone2: "",
  email: "",
  zip: "",
  address: "",
  city: "",
  state: "",
  reputation: "",
  notes: "",
  legal_name: "",
  ein: "",
};

export default function BillingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const isEditing = !!id;

  useEffect(() => {
    if (isEditing) {
      API.get(`/billing/${id}`)
        .then((res) => {
          const data = res.data;
          if (data.dob) {
            data.dob = data.dob.slice(0, 10);
          }
          setFormData(data);
        })
        .catch(() => toast.error("error loading billing data"));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await API.put(`/billing/${id}`, formData);
        toast.success("updated successfully");
      } else {
        await API.post("/billing", formData);
        toast.success("added successfully");
      }
      navigate("/billing");
    } catch (err) {
      toast.error("error occurred: " + (err.response?.data?.message || err.message || "error"));
    }
  };

  return (
    <div className="min-h-screen p-6 text-black dark:text-white bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{isEditing ? "Edit Billing Account" : "Create New Billing Account"}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isEditing ? "Update account information" : "Add a new billing account to the system"}
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700"
        >
          {/* Personal Information Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {["full_name", "legal_name", "dob"].map((key) => {
                const isDateField = key === "dob";
                return (
                  <div key={key} className="flex flex-col">
                    <label htmlFor={key} className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">
                      {key.replace(/_/g, " ")}
                    </label>
                    <input
                      id={key}
                      type={isDateField ? "date" : "text"}
                      className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      value={formData[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {["email", "phone1", "phone2"].map((key) => (
                <div key={key} className="flex flex-col">
                  <label htmlFor={key} className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">
                    {key === "phone1" ? "Primary Phone" : key === "phone2" ? "Secondary Phone" : key.replace(/_/g, " ")}
                  </label>
                  <input
                    id={key}
                    type={key === "email" ? "email" : "tel"}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    value={formData[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Address Information Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
              Address Information
            </h2>
            <div className="grid grid-cols-1 gap-6 mb-4">
              <div className="flex flex-col">
                <label htmlFor="address" className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">
                  Street Address
                </label>
                <input
                  id="address"
                  type="text"
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {["city", "state", "zip"].map((key) => (
                <div key={key} className="flex flex-col">
                  <label htmlFor={key} className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">
                    {key}
                  </label>
                  <input
                    id={key}
                    type="text"
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    value={formData[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Business Information Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
              Business Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {["ein", "reputation"].map((key) => (
                <div key={key} className="flex flex-col">
                  <label htmlFor={key} className="mb-2 text-sm font-semibold uppercase text-gray-700 dark:text-gray-200">
                    {key === "ein" ? "EIN (Employer ID)" : "Reputation"}
                  </label>
                  <input
                    id={key}
                    type="text"
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    value={formData[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
              Additional Notes
            </h2>
            <div className="flex flex-col">
              <label htmlFor="notes" className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">
                Notes
              </label>
              <textarea
                id="notes"
                rows="4"
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate("/billing")}
              className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition shadow-md"
            >
              {isEditing ? "Update Account" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
