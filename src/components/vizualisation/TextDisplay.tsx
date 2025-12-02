const TextDisplay = ({ data, error }: { data: object[]; error: string | null }) => {
  return (!data ||data.length === 0) ? (<div>No data available: {error}</div>
  ) : (
    <table className="w-full table-auto border-collapse border border-gray-300">
      <thead>
        <tr>
          {Object.keys(data[0]).map((key) => (
            <th key={key} className="border border-gray-300 px-4 py-2 bg-gray-100 text-left">{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className="bg-white">
            {Object.values(row).map((value, colIndex) => (
              <td key={colIndex} className="border border-gray-300 px-4 py-2">{String(value)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>  
  );
};

export default TextDisplay