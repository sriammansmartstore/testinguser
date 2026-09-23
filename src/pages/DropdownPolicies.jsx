import React, { useState } from "react";
import { ListItemButton, ListItemText, Collapse, List, ListItem, Divider } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

const policyLinks = [
  { label: "Terms and Conditions", path: "/terms" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Refund & Cancellation Policy", path: "/refund-cancellation" },
  { label: "Shipping Policy", path: "/shipping" },
  { label: "Return Policy", path: "/return" },
];

const DropdownPolicies = ({ onClose, navigate }) => {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen((prev) => !prev);
  };

  return (
    <>
      <ListItemButton onClick={handleClick} sx={{ pl: 2 }}>
        <ListItemText primary="Policies" />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {policyLinks.map((link) => (
            <ListItem key={link.path} disablePadding>
              <ListItemButton
                onClick={() => {
                  if (onClose) onClose();
                  navigate(link.path);
                }}
                sx={{ pl: 4 }}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
      </Collapse>
    </>
  );
};

export default DropdownPolicies;
