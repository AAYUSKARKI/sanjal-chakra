import { NavLink } from 'react-router-dom';
import { menuItemsData } from '../assets/assets';

const MenuItems = ({ setSidebarOpen }) => {
  return (
    <nav className="px-4 py-3 text-gray-600 space-y-1 font-medium">
      {menuItemsData.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'hover:bg-gray-50 hover:text-indigo-600'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default MenuItems;
