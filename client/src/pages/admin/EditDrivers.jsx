import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DriverForm from "./DriversForm";
import API from "../../api/axios";
import { toast } from "sonner";

const EditDriver = () => {
  const { id } = useParams();
  const [driverData, setDriverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDriverData();
  }, [id]);

  const fetchDriverData = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/drivers/${id}`);
      setDriverData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching driver data");
      console.error("Error fetching driver:", error);
      navigate("/drivers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      await API.put(`/drivers/${id}`, formData);
      toast.success("Driver updated successfully!");
      navigate("/drivers");
    } catch (error) {
      toast.error(error.response?.data?.message || "Error updating driver");
      console.error("Error updating driver:", error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 dark:bg-gray-900 dark:text-white min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading driver data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 dark:bg-gray-900 dark:text-white min-h-screen">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Edit Driver</h2>
        <p className="text-gray-600 dark:text-gray-400">Update driver information below</p>
      </div>
      {driverData ? (
        <DriverForm
          onSubmit={handleSubmit}
          initialData={driverData}
          isEditing={true}
        />
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400">
          No driver data found
        </div>
      )}
    </div>
  );
};

export default EditDriver;

