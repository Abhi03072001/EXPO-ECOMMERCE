export const capitalizeFirstLetter = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending': return 'orange';            
    case 'shipped': return 'blue';
    case 'delivered': return 'green';
    case 'cancelled': return 'red';
    default: return 'gray';
  }
}