using System;
using System.Collections.Generic;

namespace DOCXEditorAPIServices.Models
{
    public partial class DiagramData
    {
        public int Id { get; set; }
        public string DiagramName { get; set; } = string.Empty;
        public string DiagramContent { get; set; } = string.Empty;
    }
}
