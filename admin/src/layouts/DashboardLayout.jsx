import { Outlet } from "react-router";


function DashboardLayout() {
  return (
    <div>
    navbar 
    <br></br>
    sidebar
    <Outlet />
    </div>
  );
}

export default DashboardLayout;