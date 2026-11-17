import API from "../../api/axios";
import { useNavigate } from "react-router-dom";
import DriverForm from "./DriversForm";
import { toast } from "sonner";

const NewDriver = () => {
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    try {
      await API.post("/drivers", formData);
      toast.success("Driver added successfully!");
      navigate("/drivers");
    } catch (error) {
      toast.error(error.response?.data?.message || "Error adding driver");
      console.error("❌ Error adding driver:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 dark:bg-gray-900 dark:text-white min-h-screen">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Add New Driver</h2>
        <p className="text-gray-600 dark:text-gray-400">Fill in the form below to add a new driver to the system</p>
      </div>
      <DriverForm onSubmit={handleSubmit} isEditing={false} />
    </div>
  );
};

export default NewDriver;

